const allowedSections = new Set(["about"]);

export const onRequestGet = async ({ env, params }) => {
	const section = String(params.section || "");
	if (!allowedSections.has(section)) {
		return Response.json({ error: "Unknown content section." }, { status: 404 });
	}

	if (!env.CONTENT_KV) {
		return Response.json({ content: null }, {
			headers: { "Cache-Control": "public, max-age=60" },
		});
	}

	const content = await env.CONTENT_KV.get(`content:${section}`, "json");
	return Response.json({ content }, {
		headers: { "Cache-Control": "public, max-age=60" },
	});
};
