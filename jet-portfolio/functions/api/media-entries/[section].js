import {
	normalizeMediaSection,
	publicJson,
	readMediaEntries,
	sortMediaEntriesNewest,
	toPublicMediaEntry,
} from "../../_shared/media-entries.js";

export const onRequestGet = async ({ env, params }) => {
	const section = normalizeMediaSection(params.section);
	if (!section) {
		return publicJson(
			{ error: "Unknown media section." },
			{ status: 404 },
		);
	}

	if (!env.CONTENT_KV) {
		return publicJson({ entries: [] });
	}

	try {
		const entries = sortMediaEntriesNewest(
			await readMediaEntries(env.CONTENT_KV, section),
		).map(toPublicMediaEntry);
		return publicJson({ entries });
	} catch (error) {
		console.error("Could not load public media entries.", error);
		return publicJson(
			{ error: "Media entries are temporarily unavailable.", entries: [] },
			{ status: 500 },
		);
	}
};
