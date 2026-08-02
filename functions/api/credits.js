import {
	publicJson,
	readCreditsDocument,
	toPublicCreditCategory,
} from "../_shared/credits.js";

export const onRequestGet = async ({ env }) => {
	if (!env.CONTENT_KV) {
		return publicJson({ categories: [] });
	}

	try {
		const document = await readCreditsDocument(env.CONTENT_KV);
		return publicJson({
			categories: document.categories.map(toPublicCreditCategory),
		});
	} catch (error) {
		console.error("Could not load public credits.", error);
		return publicJson(
			{ error: "Credits are temporarily unavailable.", categories: [] },
			{ status: 500 },
		);
	}
};
