const INLINE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"image/gif",
	"video/mp4",
	"video/webm",
	"video/ogg",
	"video/quicktime",
	"audio/mpeg",
	"audio/mp4",
	"audio/ogg",
	"audio/wav",
	"application/pdf",
]);

const contentDisposition = (object, key, renamedFile) => {
	const contentType = object.httpMetadata?.contentType || "";
	const originalName = String(
		renamedFile || object.customMetadata?.originalName || key,
	)
		.replace(/[\r\n"]/g, "")
		.slice(0, 180);
	const fallbackName =
		originalName.replace(/[^\x20-\x7e]/g, "_").replace(/\\/g, "_") ||
		"attachment";
	const disposition = INLINE_TYPES.has(contentType) ? "inline" : "attachment";
	const encodedName = encodeURIComponent(originalName).replace(/'/g, "%27");
	return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
};

export const onRequestGet = async ({ request, env, params }) => {
	if (!env.MEDIA_BUCKET) {
		return new Response("Media storage is not configured.", { status: 503 });
	}

	const key = String(params.key || "");
	if (!key || key.includes("/") || key.length > 240) {
		return new Response("Not found", { status: 404 });
	}

	const requestedRange = request.headers.get("Range");
	let object;
	try {
		object = await env.MEDIA_BUCKET.get(
			key,
			requestedRange ? { range: request.headers } : undefined,
		);
	} catch {
		return new Response("Requested range is not satisfiable.", {
			status: 416,
			headers: { "Accept-Ranges": "bytes" },
		});
	}
	if (!object) return new Response("Not found", { status: 404 });
	let renamedFile = "";
	if (env.CONTENT_KV) {
		try {
			const names = await env.CONTENT_KV.get("media-library:names", "json");
			if (names && typeof names[key] === "string") renamedFile = names[key];
		} catch (error) {
			console.error("Could not load the media display name.", error);
		}
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("ETag", object.httpEtag);
	headers.set("Cache-Control", "public, max-age=86400");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Accept-Ranges", "bytes");
	headers.set(
		"Content-Disposition",
		contentDisposition(object, key, renamedFile),
	);

	let status = 200;
	if (requestedRange && object.range) {
		const explicitOffset = Number(object.range.offset);
		const explicitLength = Number(object.range.length);
		const suffixLength = Number(object.range.suffix);
		const rangeOffset = Number.isFinite(explicitOffset)
			? explicitOffset
			: Math.max(
					0,
					object.size -
						(Number.isFinite(suffixLength) ? suffixLength : object.size),
				);
		const rangeLength = Number.isFinite(explicitLength)
			? explicitLength
			: Number.isFinite(suffixLength)
				? Math.min(suffixLength, object.size)
				: object.size - rangeOffset;
		headers.set(
			"Content-Range",
			`bytes ${rangeOffset}-${rangeOffset + rangeLength - 1}/${object.size}`,
		);
		headers.set("Content-Length", String(rangeLength));
		status = 206;
	}

	return new Response(object.body, { headers, status });
};
