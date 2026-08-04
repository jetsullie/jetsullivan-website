import {
	publicJson,
	readCreditsDocument,
	toPublicCreditCategory,
} from "./credits.js";

export const createPublicCreditsHandler = (storageKey) => async ({ env }) => {
	if (!env.CONTENT_KV) {
		return publicJson({ categories: [] });
	}

	try {
		const document = await readCreditsDocument(env.CONTENT_KV, storageKey);
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
