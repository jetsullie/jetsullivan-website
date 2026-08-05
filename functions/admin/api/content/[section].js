import {
	BIOGRAPHY_MAX_LENGTH,
	biographyDocumentFromText,
	biographyDocumentToText,
	normalizeBiographyDocument,
} from "../../../_shared/biography.js";

const allowedSections = new Set(["about"]);

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

	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return noStoreJson({ error: "Invalid biography data." }, { status: 400 });
	}

	const hasRichDocument = body.biographyDocument !== undefined;
	const biographyDocumentInput = hasRichDocument
		? body.biographyDocument
		: typeof body.biography === "string"
			? biographyDocumentFromText(body.biography)
			: null;
	const biographyDocument = normalizeBiographyDocument(biographyDocumentInput);
	if (!biographyDocument) {
		return noStoreJson(
			{ error: "Biography formatting data is invalid." },
			{ status: 400 },
		);
	}

	const biography = biographyDocumentToText(biographyDocument);
	if (!biography || biography.length > BIOGRAPHY_MAX_LENGTH) {
		return noStoreJson(
			{
				error: `Biography must be between 1 and ${BIOGRAPHY_MAX_LENGTH} characters.`,
			},
			{ status: 400 },
		);
	}

	const content = {
		biography,
		biographyDocument,
		updatedAt: new Date().toISOString(),
	};
	await env.CONTENT_KV.put(`content:${section}`, JSON.stringify(content));
	return noStoreJson({ content });
};
