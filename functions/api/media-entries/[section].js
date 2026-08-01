import {
	FEATURED_PROMOTION_SECTIONS,
	noStoreJson,
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
	const json = section === "featured" ? noStoreJson : publicJson;

	if (!env.CONTENT_KV) {
		return json({ entries: [] });
	}

	try {
		let storedEntries;
		if (section === "featured") {
			const nativeFeatured = await readMediaEntries(env.CONTENT_KV, "featured");
			const promotedGroups = await Promise.all(
				[...FEATURED_PROMOTION_SECTIONS].map(async (sourceSection) =>
					(await readMediaEntries(env.CONTENT_KV, sourceSection))
						.filter((entry) => entry.featured === true)
						.map((entry) => ({ ...entry, section: sourceSection })),
				),
			);
			storedEntries = [...nativeFeatured, ...promotedGroups.flat()];
		} else {
			storedEntries = await readMediaEntries(env.CONTENT_KV, section);
		}

		const entries = sortMediaEntriesNewest(storedEntries).map(toPublicMediaEntry);
		return json({ entries });
	} catch (error) {
		console.error("Could not load public media entries.", error);
		return json(
			{ error: "Media entries are temporarily unavailable.", entries: [] },
			{ status: 500 },
		);
	}
};
