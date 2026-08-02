import {
	CREDITS_SCHEMA_VERSION,
	CreditRequestError,
	MAX_CREDIT_CATEGORIES,
	assertUniqueCreditPositions,
	creditPositionKey,
	noStoreJson,
	normalizeCreditCategoryInput,
	readCreditPayload,
	readCreditsDocument,
	requireCreditId,
	writeCreditsDocument,
} from "../../_shared/credits.js";

const requireContentKv = (env) => {
	if (!env.CONTENT_KV) {
		throw new CreditRequestError("CONTENT_KV binding is missing.", 503);
	}
	return env.CONTENT_KV;
};

const errorResponse = (error) => {
	if (error instanceof CreditRequestError) {
		return noStoreJson({ error: error.message }, { status: error.status });
	}
	console.error("Credits request failed.", error);
	return noStoreJson(
		{ error: "The credits request could not be completed." },
		{ status: 500 },
	);
};

const ensureUniquePosition = (categories, position, exceptId = null) => {
	const key = creditPositionKey(position);
	if (
		categories.some(
			(category) =>
				category.id !== exceptId && creditPositionKey(category.position) === key,
		)
	) {
		throw new CreditRequestError(`The position “${position}” already exists.`, 409);
	}
};

export const onRequestGet = async ({ env }) => {
	try {
		const kv = requireContentKv(env);
		const document = await readCreditsDocument(kv);
		return noStoreJson({
			schemaVersion: CREDITS_SCHEMA_VERSION,
			categories: document.categories,
			updatedAt: document.updatedAt,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPost = async ({ request, env }) => {
	try {
		const kv = requireContentKv(env);
		const document = await readCreditsDocument(kv);
		if (document.categories.length >= MAX_CREDIT_CATEGORIES) {
			throw new CreditRequestError(
				`Credits have reached the ${MAX_CREDIT_CATEGORIES}-category limit.`,
				409,
			);
		}

		const payload = await readCreditPayload(request);
		const input = normalizeCreditCategoryInput(payload);
		ensureUniquePosition(document.categories, input.position);

		const timestamp = new Date().toISOString();
		const category = {
			id: crypto.randomUUID(),
			...input,
			createdAt: timestamp,
			updatedAt: timestamp,
		};
		const updatedDocument = await writeCreditsDocument(kv, [
			...document.categories,
			category,
		]);
		return noStoreJson(
			{
				category,
				categories: updatedDocument.categories,
				updatedAt: updatedDocument.updatedAt,
			},
			{ status: 201 },
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPut = async ({ request, env }) => {
	try {
		const kv = requireContentKv(env);
		const payload = await readCreditPayload(request);
		const id = requireCreditId(payload.id);
		const document = await readCreditsDocument(kv);
		const categoryIndex = document.categories.findIndex(
			(category) => category.id === id,
		);
		if (categoryIndex < 0) {
			throw new CreditRequestError("Credit category not found.", 404);
		}

		const input = normalizeCreditCategoryInput(payload, {
			preserveFilmIds: true,
		});
		ensureUniquePosition(document.categories, input.position, id);

		const previousCategory = document.categories[categoryIndex];
		const category = {
			id,
			...input,
			createdAt: previousCategory.createdAt,
			updatedAt: new Date().toISOString(),
		};
		const categories = [...document.categories];
		categories[categoryIndex] = category;
		const updatedDocument = await writeCreditsDocument(kv, categories);
		return noStoreJson({
			category,
			categories: updatedDocument.categories,
			updatedAt: updatedDocument.updatedAt,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestPatch = async ({ request, env }) => {
	try {
		const kv = requireContentKv(env);
		const payload = await readCreditPayload(request);
		if (!Array.isArray(payload.categoryIds)) {
			throw new CreditRequestError("categoryIds must be an array.");
		}

		const document = await readCreditsDocument(kv);
		if (payload.categoryIds.length !== document.categories.length) {
			throw new CreditRequestError(
				"The category order does not match the current credits.",
				409,
			);
		}

		const categoryIds = payload.categoryIds.map((id) => requireCreditId(id));
		const requestedIds = new Set(categoryIds);
		const currentIds = new Set(
			document.categories.map((category) => category.id),
		);
		if (
			requestedIds.size !== categoryIds.length ||
			requestedIds.size !== currentIds.size ||
			[...requestedIds].some((id) => !currentIds.has(id))
		) {
			throw new CreditRequestError(
				"The category order must contain every current category exactly once.",
				409,
			);
		}

		const categoriesById = new Map(
			document.categories.map((category) => [category.id, category]),
		);
		const categories = categoryIds.map((id) => categoriesById.get(id));
		assertUniqueCreditPositions(categories);
		const updatedDocument = await writeCreditsDocument(kv, categories);
		return noStoreJson({
			categories: updatedDocument.categories,
			updatedAt: updatedDocument.updatedAt,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const onRequestDelete = async ({ request, env }) => {
	try {
		const kv = requireContentKv(env);
		const id = requireCreditId(new URL(request.url).searchParams.get("id"));
		const document = await readCreditsDocument(kv);
		const categoryIndex = document.categories.findIndex(
			(category) => category.id === id,
		);
		if (categoryIndex < 0) {
			throw new CreditRequestError("Credit category not found.", 404);
		}

		const categories = document.categories.filter(
			(category) => category.id !== id,
		);
		const updatedDocument = await writeCreditsDocument(kv, categories);
		return noStoreJson({
			deleted: id,
			categories: updatedDocument.categories,
			updatedAt: updatedDocument.updatedAt,
		});
	} catch (error) {
		return errorResponse(error);
	}
};
