import { gearValueSummary } from "../_shared/gear-value.js";
import {
	readGearItems,
	sortGearItems,
	toGearResponse,
} from "../_shared/gear.js";
import { publicJson } from "../_shared/media-entries.js";

export const onRequestGet = async ({ env }) => {
	if (!env.CONTENT_KV) return publicJson({ items: [], summary: gearValueSummary([]) });

	try {
		const storedItems = await readGearItems(env.CONTENT_KV);
		const items = sortGearItems(storedItems).map((item) =>
			toGearResponse(item),
		);
		return publicJson({ items, summary: gearValueSummary(storedItems) });
	} catch (error) {
		console.error("Could not load public gear.", error);
		return publicJson(
			{ error: "Gear is temporarily unavailable.", items: [] },
			{ status: 500 },
		);
	}
};
