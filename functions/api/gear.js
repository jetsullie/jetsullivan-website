import {
	readGearItems,
	sortGearItems,
	toGearResponse,
} from "../_shared/gear.js";
import { publicJson } from "../_shared/media-entries.js";

export const onRequestGet = async ({ env }) => {
	if (!env.CONTENT_KV) return publicJson({ items: [] });

	try {
		const items = sortGearItems(await readGearItems(env.CONTENT_KV)).map((item) =>
			toGearResponse(item),
		);
		return publicJson({ items });
	} catch (error) {
		console.error("Could not load public gear.", error);
		return publicJson(
			{ error: "Gear is temporarily unavailable.", items: [] },
			{ status: 500 },
		);
	}
};
