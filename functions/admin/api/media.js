import {
	MEDIA_ENTRY_SECTIONS,
	MediaEntryRequestError,
	noStoreJson,
	readMediaEntries,
	validateMediaAttachment,
	writeMediaEntry,
} from "../../_shared/media-entries.js";

const maxUploadBytes = 100 * 1024 * 1024;
const MEDIA_NAMES_KEY = "media-library:names";

const validMediaKey = (value) => {
	const key = String(value || "");
	return key && !key.includes("/") && key.length <= 240 ? key : null;
};

const normalizeDisplayName = (value) => {
	const name = String(value || "")
		.replace(/[\u0000-\u001f\u007f]/g, "")
		.trim();
	if (!name || name.length > 180) {
		throw new MediaEntryRequestError(
			"File names must be between 1 and 180 characters.",
		);
	}
	return name;
};

const readNameOverrides = async (kv) => {
	if (!kv) return {};
	const value = await kv.get(MEDIA_NAMES_KEY, "json");
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
};

const writeNameOverrides = async (kv, names) => {
	if (!kv) return;
	await kv.put(MEDIA_NAMES_KEY, JSON.stringify(names));
};

const readEntryGroups = async (kv) => {
	if (!kv) return [];
	return Promise.all(
		[...MEDIA_ENTRY_SECTIONS].map(async (section) => ({
			section,
			entries: await readMediaEntries(kv, section),
		})),
	);
};

const buildReferenceMap = (groups) => {
	const references = new Map();
	const add = (key, reference) => {
		if (!key) return;
		const existing = references.get(key) || [];
		existing.push(reference);
		references.set(key, existing);
	};

	for (const group of groups) {
		for (const entry of group.entries) {
			add(entry.imageKey, {
				section: group.section,
				entryId: entry.id,
				title: entry.title || "Untitled post",
				role: "Primary photo",
			});
			add(entry.attachmentKey, {
				section: group.section,
				entryId: entry.id,
				title: entry.title || "Untitled post",
				role: "Post attachment",
			});
		}
	}
	return references;
};

const updateReferencesForRename = async (kv, groups, key, displayName) => {
	if (!kv) return 0;
	let updated = 0;
	for (const group of groups) {
		for (const entry of group.entries) {
			if (entry.attachmentKey !== key) continue;
			await writeMediaEntry(kv, group.section, {
				...entry,
				attachmentName: displayName,
				updatedAt: new Date().toISOString(),
			});
			updated += 1;
		}
	}
	return updated;
};

const clearReferencesForDelete = async (kv, groups, key) => {
	if (!kv) return 0;
	let updated = 0;
	for (const group of groups) {
		for (const entry of group.entries) {
			const clearsImage = entry.imageKey === key;
			const clearsAttachment = entry.attachmentKey === key;
			if (!clearsImage && !clearsAttachment) continue;

			await writeMediaEntry(kv, group.section, {
				...entry,
				...(clearsImage
					? { imageKey: null, imageType: null, imageAlt: null }
					: {}),
				...(clearsAttachment
					? {
							attachmentKey: null,
							attachmentType: null,
							attachmentName: null,
							attachmentAlt: null,
						}
					: {}),
				updatedAt: new Date().toISOString(),
			});
			updated += 1;
		}
	}
	return updated;
};

const errorResponse = (error) => {
	if (error instanceof MediaEntryRequestError) {
		return noStoreJson({ error: error.message }, { status: error.status });
	}
	console.error("Media library request failed.", error);
	return noStoreJson(
		{ error: "The media library request could not be completed." },
		{ status: 500 },
	);
};

export const onRequestGet = async ({ env }) => {
	if (!env.MEDIA_BUCKET) {
		return noStoreJson(
			{ error: "MEDIA_BUCKET binding is missing." },
			{ status: 503 },
		);
	}

	try {
		const media = [];
		let cursor;
		do {
			const result = await env.MEDIA_BUCKET.list({
				limit: 1000,
				include: ["httpMetadata", "customMetadata"],
				...(cursor ? { cursor } : {}),
			});
			media.push(...result.objects);
			cursor = result.truncated ? result.cursor : undefined;
		} while (cursor);

		const [names, groups] = await Promise.all([
			readNameOverrides(env.CONTENT_KV),
			readEntryGroups(env.CONTENT_KV),
		]);
		const references = buildReferenceMap(groups);
		const result = media
			.map((object) => ({
				key: object.key,
				name:
					typeof names[object.key] === "string"
						? names[object.key]
						: object.customMetadata?.originalName || object.key,
				size: object.size,
				uploaded: object.uploaded,
				contentType: object.httpMetadata?.contentType || "application/octet-stream",
				managed: object.key.startsWith("entry-"),
				url: `/api/media/${encodeURIComponent(object.key)}`,
				usedBy: references.get(object.key) || [],
			}))
			.sort((left, right) =>
				String(right.uploaded || "").localeCompare(String(left.uploaded || "")),
			);

		return noStoreJson({ media: result });
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPost = async ({ request, env }) => {
	if (!env.MEDIA_BUCKET) {
		return noStoreJson(
			{ error: "MEDIA_BUCKET binding is missing." },
			{ status: 503 },
		);
	}

	try {
		const form = await request.formData();
		const validated = validateMediaAttachment(form.get("file"));
		if (!validated) {
			throw new MediaEntryRequestError("Choose a file to upload.");
		}
		if (validated.file.size > maxUploadBytes) {
			throw new MediaEntryRequestError(
				"Files must be no larger than 100 MB.",
				413,
			);
		}

		const key = `library-${Date.now()}-${crypto.randomUUID()}.${validated.extension}`;
		await env.MEDIA_BUCKET.put(key, validated.file.stream(), {
			httpMetadata: { contentType: validated.contentType },
			customMetadata: { originalName: validated.originalName },
		});
		return noStoreJson(
			{
				media: {
					key,
					name: validated.originalName,
					size: validated.file.size,
					contentType: validated.contentType,
					url: `/api/media/${encodeURIComponent(key)}`,
					usedBy: [],
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPut = async ({ request, env }) => {
	if (!env.MEDIA_BUCKET || !env.CONTENT_KV) {
		return noStoreJson(
			{ error: "MEDIA_BUCKET and CONTENT_KV bindings are required." },
			{ status: 503 },
		);
	}

	try {
		const body = await request.json();
		const key = validMediaKey(body?.key);
		if (!key) throw new MediaEntryRequestError("Invalid media key.");
		const object = await env.MEDIA_BUCKET.head(key);
		if (!object) throw new MediaEntryRequestError("Media file not found.", 404);

		const name = normalizeDisplayName(body?.name);
		const [names, groups] = await Promise.all([
			readNameOverrides(env.CONTENT_KV),
			readEntryGroups(env.CONTENT_KV),
		]);
		names[key] = name;
		await writeNameOverrides(env.CONTENT_KV, names);
		const updatedReferences = await updateReferencesForRename(
			env.CONTENT_KV,
			groups,
			key,
			name,
		);
		return noStoreJson({ key, name, updatedReferences });
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestDelete = async ({ request, env }) => {
	if (!env.MEDIA_BUCKET || !env.CONTENT_KV) {
		return noStoreJson(
			{ error: "MEDIA_BUCKET and CONTENT_KV bindings are required." },
			{ status: 503 },
		);
	}

	try {
		const key = validMediaKey(new URL(request.url).searchParams.get("key"));
		if (!key) throw new MediaEntryRequestError("Invalid media key.");
		const object = await env.MEDIA_BUCKET.head(key);
		if (!object) throw new MediaEntryRequestError("Media file not found.", 404);

		const [names, groups] = await Promise.all([
			readNameOverrides(env.CONTENT_KV),
			readEntryGroups(env.CONTENT_KV),
		]);
		const updatedReferences = await clearReferencesForDelete(
			env.CONTENT_KV,
			groups,
			key,
		);
		await env.MEDIA_BUCKET.delete(key);
		delete names[key];
		await writeNameOverrides(env.CONTENT_KV, names);
		return noStoreJson({ deleted: key, updatedReferences });
	} catch (error) {
		return errorResponse(error);
	}
};
