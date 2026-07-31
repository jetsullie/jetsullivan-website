const allowedTypes = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"video/mp4",
	"video/webm",
]);
const maxUploadBytes = 100 * 1024 * 1024;
const isManagedEntryFile = (key) =>
	typeof key === "string" && key.startsWith("entry-");

const noStoreJson = (body, init = {}) =>
	Response.json(body, {
		...init,
		headers: { ...init.headers, "Cache-Control": "no-store" },
	});

export const onRequestGet = async ({ env }) => {
	if (!env.MEDIA_BUCKET) {
		return noStoreJson({ error: "MEDIA_BUCKET binding is missing." }, { status: 503 });
	}
	const media = [];
	let cursor;

	do {
		const result = await env.MEDIA_BUCKET.list({
			limit: 1000,
			...(cursor ? { cursor } : {}),
		});
		for (const object of result.objects) {
			if (isManagedEntryFile(object.key)) continue;
			media.push({
				key: object.key,
				size: object.size,
				uploaded: object.uploaded,
				url: `/api/media/${encodeURIComponent(object.key)}`,
			});
			if (media.length >= 100) break;
		}
		cursor = result.truncated ? result.cursor : undefined;
	} while (cursor && media.length < 100);

	return noStoreJson({ media });
};

export const onRequestPost = async ({ request, env }) => {
	if (!env.MEDIA_BUCKET) {
		return noStoreJson({ error: "MEDIA_BUCKET binding is missing." }, { status: 503 });
	}
	const form = await request.formData();
	const file = form.get("file");
	if (!(file instanceof File)) {
		return noStoreJson({ error: "Choose a file to upload." }, { status: 400 });
	}
	if (!allowedTypes.has(file.type)) {
		return noStoreJson({ error: "Unsupported file type." }, { status: 415 });
	}
	if (file.size <= 0 || file.size > maxUploadBytes) {
		return noStoreJson({ error: "Files must be no larger than 100 MB." }, { status: 413 });
	}

	const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
	const key = `library-${Date.now()}-${crypto.randomUUID()}.${extension}`;
	await env.MEDIA_BUCKET.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
		customMetadata: { originalName: file.name.slice(0, 180) },
	});
	return noStoreJson({
		media: { key, size: file.size, url: `/api/media/${encodeURIComponent(key)}` },
	}, { status: 201 });
};

export const onRequestDelete = async ({ request, env }) => {
	if (!env.MEDIA_BUCKET) {
		return noStoreJson({ error: "MEDIA_BUCKET binding is missing." }, { status: 503 });
	}
	const key = new URL(request.url).searchParams.get("key");
	if (!key || key.includes("/") || key.length > 240) {
		return noStoreJson({ error: "Invalid media key." }, { status: 400 });
	}
	if (isManagedEntryFile(key)) {
		return noStoreJson(
			{ error: "Managed post files cannot be deleted from the unassigned library." },
			{ status: 403 },
		);
	}
	await env.MEDIA_BUCKET.delete(key);
	return noStoreJson({ deleted: key });
};
