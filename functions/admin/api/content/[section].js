const allowedSections = new Set(["about"]);
const maxBiographyLength = 5000;

const noStoreJson = (body, init = {}) =>
	Response.json(body, {
		...init,
		headers: { ...init.headers, "Cache-Control": "no-store" },
	});

export const onRequestGet = async ({ env, params }) => {
	const section = String(params.section || "");
	if (!allowedSections.has(section)) {
		return noStoreJson({ error: "Unknown content section." }, { status: 404 });
	}
	if (!env.CONTENT_KV) {
		return noStoreJson({ error: "CONTENT_KV binding is missing." }, { status: 503 });
	}

	const content = await env.CONTENT_KV.get(`content:${section}`, "json");
	return noStoreJson({ content });
};

export const onRequestPut = async ({ request, env, params }) => {
	const section = String(params.section || "");
	if (!allowedSections.has(section)) {
		return noStoreJson({ error: "Unknown content section." }, { status: 404 });
	}
	if (!env.CONTENT_KV) {
		return noStoreJson({ error: "CONTENT_KV binding is missing." }, { status: 503 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return noStoreJson({ error: "Invalid JSON." }, { status: 400 });
	}

	const biography = typeof body.biography === "string" ? body.biography.trim() : "";
	if (!biography || biography.length > maxBiographyLength) {
		return noStoreJson(
			{ error: `Biography must be between 1 and ${maxBiographyLength} characters.` },
			{ status: 400 },
		);
	}

	const content = { biography, updatedAt: new Date().toISOString() };
	await env.CONTENT_KV.put(`content:${section}`, JSON.stringify(content));
	return noStoreJson({ content });
};
