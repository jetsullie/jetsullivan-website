import {
	MAX_MEDIA_ENTRIES_PER_SECTION,
	MediaEntryRequestError,
	ATTACHMENT_ENTRY_SECTIONS,
	deleteMediaEntryImage,
	listMediaEntryKeys,
	noStoreJson,
	normalizeMediaSection,
	putMediaEntryAttachment,
	putMediaEntryImage,
	readMediaEntry,
	readMediaEntries,
	readMediaEntryPayload,
	removeMediaEntry,
	sortMediaEntriesNewest,
	toAdminMediaEntry,
	validateMediaEntryMetadata,
	validateMediaAttachment,
	validateMediaImage,
	writeMediaEntry,
} from "../../../_shared/media-entries.js";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireSection = (params) => {
	const section = normalizeMediaSection(params.section);
	if (!section) {
		throw new MediaEntryRequestError("Unknown media section.", 404);
	}
	return section;
};

const requireContentKv = (env) => {
	if (!env.CONTENT_KV) {
		throw new MediaEntryRequestError("CONTENT_KV binding is missing.", 503);
	}
	return env.CONTENT_KV;
};

const requireEntryId = (value) => {
	const id = String(value || "").trim();
	if (!UUID_PATTERN.test(id)) {
		throw new MediaEntryRequestError("A valid media entry ID is required.");
	}
	return id;
};

const errorResponse = (error) => {
	if (error instanceof MediaEntryRequestError) {
		return noStoreJson({ error: error.message }, { status: error.status });
	}
	console.error("Media entry request failed.", error);
	return noStoreJson(
		{ error: "The media entry request could not be completed." },
		{ status: 500 },
	);
};

export const onRequestGet = async ({ env, params }) => {
	try {
		const section = requireSection(params);
		const kv = requireContentKv(env);
		const entries = sortMediaEntriesNewest(
			await readMediaEntries(kv, section),
		).map(toAdminMediaEntry);
		return noStoreJson({ entries });
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPost = async ({ request, env, params }) => {
	let uploadedImage = null;
	let uploadedAttachment = null;

	try {
		const section = requireSection(params);
		const kv = requireContentKv(env);
		const payload = await readMediaEntryPayload(request);
		const metadata = validateMediaEntryMetadata(section, payload);
		if (section !== "behind-the-scenes" && payload.image !== null) {
			throw new MediaEntryRequestError(
				"Image uploads are only available for behind-the-scenes entries.",
			);
		}
		const validatedImage = validateMediaImage(payload.image);
		const validatedAttachment = ATTACHMENT_ENTRY_SECTIONS.has(section)
			? validateMediaAttachment(payload.attachment)
			: null;
		if (payload.removeAttachment && validatedAttachment) {
			throw new MediaEntryRequestError(
				"Choose either a replacement attachment or remove the current attachment.",
			);
		}
		const existingKeys = await listMediaEntryKeys(kv, section);

		if (existingKeys.length >= MAX_MEDIA_ENTRIES_PER_SECTION) {
			throw new MediaEntryRequestError(
				"This media section has reached its 200-entry limit.",
				409,
			);
		}

		const id = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		if (validatedImage) {
			uploadedImage = await putMediaEntryImage({
				env,
				section,
				entryId: id,
				validatedImage,
			});
		}
		if (validatedAttachment) {
			uploadedAttachment = await putMediaEntryAttachment({
				env,
				section,
				entryId: id,
				validatedAttachment,
			});
		}

		const entry = {
			id,
			section,
			...metadata,
			imageKey: uploadedImage?.imageKey || null,
			imageType: uploadedImage?.imageType || null,
			attachmentKey: uploadedAttachment?.attachmentKey || null,
			attachmentType: uploadedAttachment?.attachmentType || null,
			attachmentName: uploadedAttachment?.attachmentName || null,
			createdAt: timestamp,
			updatedAt: timestamp,
		};

		try {
			await writeMediaEntry(kv, section, entry);
		} catch (error) {
			if (uploadedImage?.imageKey) {
				await deleteMediaEntryImage(env, uploadedImage.imageKey);
			}
			if (uploadedAttachment?.attachmentKey) {
				await deleteMediaEntryImage(env, uploadedAttachment.attachmentKey);
			}
			throw error;
		}

		try {
			const keysAfterCreate = await listMediaEntryKeys(kv, section);
			if (keysAfterCreate.length > MAX_MEDIA_ENTRIES_PER_SECTION) {
				await removeMediaEntry(kv, section, id);
				if (uploadedImage?.imageKey) {
					await deleteMediaEntryImage(env, uploadedImage.imageKey);
				}
				if (uploadedAttachment?.attachmentKey) {
					await deleteMediaEntryImage(
						env,
						uploadedAttachment.attachmentKey,
					);
				}
				throw new MediaEntryRequestError(
					"This media section has reached its 200-entry limit.",
					409,
				);
			}
		} catch (error) {
			if (error instanceof MediaEntryRequestError) throw error;
			console.error("Could not verify the media entry count.", error);
		}

		return noStoreJson(
			{ entry: toAdminMediaEntry(entry) },
			{ status: 201 },
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPut = async ({ request, env, params }) => {
	let replacementImage = null;
	let replacementAttachment = null;

	try {
		const section = requireSection(params);
		const kv = requireContentKv(env);
		const payload = await readMediaEntryPayload(request);
		const id = requireEntryId(payload.id);
		const metadata = validateMediaEntryMetadata(section, payload);
		const previousEntry = await readMediaEntry(kv, section, id);

		if (!previousEntry) {
			throw new MediaEntryRequestError("Media entry not found.", 404);
		}

		if (section !== "behind-the-scenes" && payload.image !== null) {
			throw new MediaEntryRequestError(
				"Image uploads are only available for behind-the-scenes entries.",
			);
		}
		const validatedImage = validateMediaImage(payload.image);
		const validatedAttachment = ATTACHMENT_ENTRY_SECTIONS.has(section)
			? validateMediaAttachment(payload.attachment)
			: null;
		if (payload.removeAttachment && validatedAttachment) {
			throw new MediaEntryRequestError(
				"Choose either a replacement attachment or remove the current attachment.",
			);
		}

		if (validatedImage) {
			replacementImage = await putMediaEntryImage({
				env,
				section,
				entryId: id,
				validatedImage,
			});
		}
		if (validatedAttachment) {
			replacementAttachment = await putMediaEntryAttachment({
				env,
				section,
				entryId: id,
				validatedAttachment,
			});
		}

		const entry = {
			...previousEntry,
			id,
			section,
			...metadata,
			attachmentAlt: payload.removeAttachment
				? null
				: metadata.attachmentAlt,
			imageKey: replacementImage?.imageKey || previousEntry.imageKey || null,
			imageType:
				replacementImage?.imageType || previousEntry.imageType || null,
			attachmentKey:
				replacementAttachment?.attachmentKey ||
				(payload.removeAttachment ? null : previousEntry.attachmentKey) ||
				null,
			attachmentType:
				replacementAttachment?.attachmentType ||
				(payload.removeAttachment ? null : previousEntry.attachmentType) ||
				null,
			attachmentName:
				replacementAttachment?.attachmentName ||
				(payload.removeAttachment ? null : previousEntry.attachmentName) ||
				null,
			createdAt: previousEntry.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		try {
			await writeMediaEntry(kv, section, entry);
		} catch (error) {
			if (replacementImage?.imageKey) {
				await deleteMediaEntryImage(env, replacementImage.imageKey);
			}
			if (replacementAttachment?.attachmentKey) {
				await deleteMediaEntryImage(
					env,
					replacementAttachment.attachmentKey,
				);
			}
			throw error;
		}

		// Keep the replaced object until a separate cleanup pass. Public entry JSON
		// can be cached for 60 seconds and may still reference the previous image.

		return noStoreJson({ entry: toAdminMediaEntry(entry) });
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestDelete = async ({ request, env, params }) => {
	try {
		const section = requireSection(params);
		const kv = requireContentKv(env);
		const id = requireEntryId(new URL(request.url).searchParams.get("id"));
		const entry = await readMediaEntry(kv, section, id);

		if (!entry) {
			throw new MediaEntryRequestError("Media entry not found.", 404);
		}

		await removeMediaEntry(kv, section, id);

		// Retain any former image object for deferred cleanup so cached public JSON
		// cannot briefly point at a deleted R2 object.

		return noStoreJson({ deleted: id });
	} catch (error) {
		return errorResponse(error);
	}
};
