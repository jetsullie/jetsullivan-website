export const onRequestGet = async () => {
	return Response.json({ media: [] }, {
		headers: { "Cache-Control": "public, max-age=60" },
	});
};
