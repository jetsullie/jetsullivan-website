import { parseEstimatedValue, storedEstimatedValue } from "./gear-value.js";
import {
	MediaEntryRequestError,
	mediaImageUrl,
	putMediaEntryImage,
	validateMediaImage,
} from "./media-entries.js";

export const GEAR_PREFIX = "gear:item:";

const isObject = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const readTextField = (form, name) => {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
};

export const readGearPayload = async (request) => {
	const contentType = request.headers.get("Content-Type") || "";
	if (!contentType.includes("multipart/form-data")) {
		throw new MediaEntryRequestError("Use multipart form data for gear items.", 415);
	}

	let form;
	try {
		form = await request.formData();
	} catch {
		throw new MediaEntryRequestError("Invalid gear form data.");
	}

	const imageField = form.get("image");
	const image =
		imageField === "" ||
		(isObject(imageField) && Number(imageField.size) === 0)
			? null
			: imageField;

	return {
		id: readTextField(form, "id"),
		name: readTextField(form, "name"),
		category: readTextField(form, "category"),
		rating: readTextField(form, "rating"),
		estimatedValue: readTextField(form, "estimatedValue"),
		description: readTextField(form, "description"),
		kitParts: readTextField(form, "kitParts"),
		imageAlt: readTextField(form, "imageAlt"),
		image,
	};
};

export const validateGearMetadata = (payload) => {
	const name = payload.name.trim().replace(/\s+/g, " ");
	const category = payload.category.trim().replace(/\s+/g, " ");
	const description = payload.description.trim();
	const imageAlt = payload.imageAlt.trim().replace(/\s+/g, " ");
	const rating = Number(payload.rating);
	let estimatedValue;
	try { estimatedValue = parseEstimatedValue(payload.estimatedValue); }
	catch (error) { throw new MediaEntryRequestError(error.message); }
	const kitParts = payload.kitParts
		.split(/\r?\n/)
		.map((part) => part.trim().replace(/\s+/g, " "))
		.filter(Boolean);

	if (!name || name.length > 120) {
		throw new MediaEntryRequestError(
			"Gear name must be between 1 and 120 characters.",
		);
	}
	if (category.length > 80) {
		throw new MediaEntryRequestError("Gear category must be 80 characters or fewer.");
	}
	if (!description || description.length > 20_000) {
		throw new MediaEntryRequestError(
			"Description must be between 1 and 20,000 characters.",
		);
	}
	if (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
		throw new MediaEntryRequestError("Rating must be between 0.5 and 5 in half-star steps.");
	}
	if (imageAlt.length > 180) {
		throw new MediaEntryRequestError("Image description must be 180 characters or fewer.");
	}
	if (kitParts.length > 100) {
		throw new MediaEntryRequestError("A gear kit can contain no more than 100 listed parts.");
	}
	if (kitParts.some((part) => part.length > 200)) {
		throw new MediaEntryRequestError("Each kit part must be 200 characters or fewer.");
	}

	return {
		name,
		category: category || "Gear",
		rating,
		estimatedValue,
		description,
		kitParts,
		imageAlt: imageAlt || `${name} owned by Jet Sullivan`,
	};
};

export const validateGearImage = (image, { required = false } = {}) => {
	if (required && (image === null || image === undefined)) {
		throw new MediaEntryRequestError("Choose a product photo for this gear item.");
	}
	return validateMediaImage(image, { required: false });
};

export const putGearImage = ({ env, itemId, validatedImage }) =>
	putMediaEntryImage({
		env,
		section: "gear",
		entryId: itemId,
		validatedImage,
	});

export const gearKey = (id) => `${GEAR_PREFIX}${id}`;

export const listGearKeys = async (kv) => {
	const keys = [];
	let cursor;
	do {
		const result = await kv.list({
			prefix: GEAR_PREFIX,
			limit: 1000,
			...(cursor ? { cursor } : {}),
		});
		if (Array.isArray(result.keys)) keys.push(...result.keys);
		cursor = result.list_complete === false ? result.cursor : undefined;
	} while (cursor);
	return keys;
};

const validateStoredGearItem = (item) => {
	if (!isObject(item) || typeof item.id !== "string" || !item.id) {
		throw new Error("Invalid stored gear item.");
	}
	return item;
};

export const readGearItems = async (kv) => {
	const keys = await listGearKeys(kv);
	const names = keys.map((key) => key.name);
	const items = [];

	for (let index = 0; index < names.length; index += 100) {
		const chunk = names.slice(index, index + 100);
		const bulk = await kv.get(chunk, "json");
		if (bulk instanceof Map) {
			for (const name of chunk) items.push(bulk.get(name));
		} else {
			items.push(...(await Promise.all(chunk.map((name) => kv.get(name, "json")))));
		}
	}

	return items
		.filter((item) => item !== null && item !== undefined)
		.map(validateStoredGearItem);
};

export const readGearItem = async (kv, id) => {
	const item = await kv.get(gearKey(id), "json");
	return item === null ? null : validateStoredGearItem(item);
};

export const writeGearItem = async (kv, item) => {
	await kv.put(gearKey(item.id), JSON.stringify(item));
};

export const removeGearItem = async (kv, id) => {
	await kv.delete(gearKey(id));
};

export const sortGearItems = (items) =>
	[...items].sort((left, right) => {
		const categoryOrder = String(left.category || "").localeCompare(
			String(right.category || ""),
		);
		if (categoryOrder) return categoryOrder;
		return String(left.name || "").localeCompare(String(right.name || ""));
	});

const stringOrEmpty = (value) => (typeof value === "string" ? value : "");
const stringOrNull = (value) =>
	typeof value === "string" && value ? value : null;

export const toGearResponse = (item, { admin = false } = {}) => ({
	id: stringOrEmpty(item.id),
	name: stringOrEmpty(item.name),
	category: stringOrEmpty(item.category) || "Gear",
	rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : 0,
	description: stringOrEmpty(item.description),
	kitParts: Array.isArray(item.kitParts)
		? item.kitParts.filter((part) => typeof part === "string")
		: [],
	imageAlt: stringOrEmpty(item.imageAlt),
	imageUrl: mediaImageUrl(item.imageKey),
	...(admin
		? {
				estimatedValue: storedEstimatedValue(item),
				imageKey: stringOrNull(item.imageKey),
				imageType: stringOrNull(item.imageType),
				updatedAt: stringOrEmpty(item.updatedAt),
			}
		: {}),
	createdAt: stringOrEmpty(item.createdAt),
});
