import {
	putGearImage,
	readGearItem,
	readGearItems,
	readGearPayload,
	removeGearItem,
	sortGearItems,
	toGearResponse,
	validateGearImage,
	validateGearMetadata,
	writeGearItem,
} from "../../_shared/gear.js";
import {
	MediaEntryRequestError,
	deleteMediaEntryImage,
	noStoreJson,
} from "../../_shared/media-entries.js";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireKv = (env) => {
	if (!env.CONTENT_KV) {
		throw new MediaEntryRequestError("CONTENT_KV binding is missing.", 503);
	}
	return env.CONTENT_KV;
};

const requireId = (value) => {
	const id = String(value || "").trim();
	if (!UUID_PATTERN.test(id)) {
		throw new MediaEntryRequestError("A valid gear item ID is required.");
	}
	return id;
};

const errorResponse = (error) => {
	if (error instanceof MediaEntryRequestError) {
		return noStoreJson({ error: error.message }, { status: error.status });
	}
	console.error("Gear request failed.", error);
	return noStoreJson(
		{ error: "The gear request could not be completed." },
		{ status: 500 },
	);
};

export const onRequestGet = async ({ env }) => {
	try {
		const kv = requireKv(env);
		const items = sortGearItems(await readGearItems(kv)).map((item) =>
			toGearResponse(item, { admin: true }),
		);
		return noStoreJson({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPost = async ({ request, env }) => {
	let uploadedImage = null;
	try {
		const kv = requireKv(env);
		const payload = await readGearPayload(request);
		const metadata = validateGearMetadata(payload);
		const validatedImage = validateGearImage(payload.image, { required: true });
		const id = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		uploadedImage = await putGearImage({ env, itemId: id, validatedImage });
		const item = {
			id,
			...metadata,
			imageKey: uploadedImage.imageKey,
			imageType: uploadedImage.imageType,
			createdAt: timestamp,
			updatedAt: timestamp,
		};

		try {
			await writeGearItem(kv, item);
		} catch (error) {
			await deleteMediaEntryImage(env, uploadedImage.imageKey);
			throw error;
		}

		return noStoreJson(
			{ item: toGearResponse(item, { admin: true }) },
			{ status: 201 },
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPut = async ({ request, env }) => {
	let replacementImage = null;
	try {
		const kv = requireKv(env);
		const payload = await readGearPayload(request);
		const id = requireId(payload.id);
		const metadata = validateGearMetadata(payload);
		const previous = await readGearItem(kv, id);
		if (!previous) {
			throw new MediaEntryRequestError("Gear item not found.", 404);
		}

		const validatedImage = validateGearImage(payload.image);
		if (validatedImage) {
			replacementImage = await putGearImage({ env, itemId: id, validatedImage });
		}

		const item = {
			...previous,
			id,
			...metadata,
			imageKey: replacementImage?.imageKey || previous.imageKey,
			imageType: replacementImage?.imageType || previous.imageType,
			createdAt: previous.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		try {
			await writeGearItem(kv, item);
		} catch (error) {
			if (replacementImage?.imageKey) {
				await deleteMediaEntryImage(env, replacementImage.imageKey);
			}
			throw error;
		}

		return noStoreJson({ item: toGearResponse(item, { admin: true }) });
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestDelete = async ({ request, env }) => {
	try {
		const kv = requireKv(env);
		const id = requireId(new URL(request.url).searchParams.get("id"));
		const item = await readGearItem(kv, id);
		if (!item) {
			throw new MediaEntryRequestError("Gear item not found.", 404);
		}
		await removeGearItem(kv, id);
		// Keep the image for the media-library cleanup pass so cached public data
		// never points at an object that disappeared early.
		return noStoreJson({ deleted: id });
	} catch (error) {
		return errorResponse(error);
	}
};
