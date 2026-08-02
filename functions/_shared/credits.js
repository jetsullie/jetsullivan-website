export const CREDITS_KEY = "content:credits";
export const CREDITS_SCHEMA_VERSION = 1;
export const MAX_CREDIT_CATEGORIES = 50;
export const MAX_CREDIT_FILMS_PER_CATEGORY = 100;

const MAX_POSITION_LENGTH = 80;
const MAX_FILM_NAME_LENGTH = 160;
const MAX_LINK_LENGTH = 2048;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const isObject = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export class CreditRequestError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = "CreditRequestError";
		this.status = status;
	}
}

export const noStoreJson = (body, init = {}) =>
	Response.json(body, {
		...init,
		headers: {
			...init.headers,
			"Cache-Control": "no-store",
		},
	});

export const publicJson = (body, init = {}) =>
	Response.json(body, {
		...init,
		headers: {
			...init.headers,
			"Cache-Control": "public, max-age=60",
		},
	});

export const isCreditUuid = (value) =>
	typeof value === "string" && UUID_PATTERN.test(value);

export const requireCreditId = (value, label = "credit category") => {
	const id = typeof value === "string" ? value.trim() : "";
	if (!isCreditUuid(id)) {
		throw new CreditRequestError(`A valid ${label} ID is required.`);
	}
	return id;
};

const normalizeRequiredText = (value, { label, maximum }) => {
	if (typeof value !== "string") {
		throw new CreditRequestError(`${label} is required.`);
	}
	const text = value.trim();
	if (
		!text ||
		text.length > maximum ||
		CONTROL_CHARACTER_PATTERN.test(text)
	) {
		throw new CreditRequestError(
			`${label} must be between 1 and ${maximum} characters.`,
		);
	}
	return text;
};

export const normalizeCreditPosition = (value) =>
	normalizeRequiredText(value, {
		label: "Position",
		maximum: MAX_POSITION_LENGTH,
	});

export const creditPositionKey = (value) =>
	normalizeCreditPosition(value).toLocaleLowerCase("en-US");

export const normalizeCreditColor = (value) => {
	const color = typeof value === "string" ? value.trim() : "";
	if (!COLOR_PATTERN.test(color)) {
		throw new CreditRequestError("Color must use the #RRGGBB format.");
	}
	return color.toUpperCase();
};

export const normalizeCreditLink = (value) => {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value !== "string") {
		throw new CreditRequestError("Film links must be HTTPS URLs.");
	}

	const link = value.trim();
	if (!link) return null;
	if (link.length > MAX_LINK_LENGTH) {
		throw new CreditRequestError(
			`Film links must be ${MAX_LINK_LENGTH.toLocaleString("en-US")} characters or fewer.`,
		);
	}

	let url;
	try {
		url = new URL(link);
	} catch {
		throw new CreditRequestError("Enter a valid HTTPS film link.");
	}
	if (url.protocol !== "https:" || url.username || url.password) {
		throw new CreditRequestError(
			"Film links must use HTTPS and cannot contain a username or password.",
		);
	}
	if (url.href.length > MAX_LINK_LENGTH) {
		throw new CreditRequestError(
			`Film links must be ${MAX_LINK_LENGTH.toLocaleString("en-US")} characters or fewer.`,
		);
	}
	return url.href;
};

const normalizeFilmName = (value) =>
	normalizeRequiredText(value, {
		label: "Film name",
		maximum: MAX_FILM_NAME_LENGTH,
	});

export const normalizeCreditFilms = (
	value,
	{ preserveSuppliedIds = false } = {},
) => {
	if (!Array.isArray(value) || value.length === 0) {
		throw new CreditRequestError("Add at least one film to the credit category.");
	}
	if (value.length > MAX_CREDIT_FILMS_PER_CATEGORY) {
		throw new CreditRequestError(
			`A credit category can contain at most ${MAX_CREDIT_FILMS_PER_CATEGORY} films.`,
		);
	}

	const seenIds = new Set();
	return value.map((film, index) => {
		if (!isObject(film)) {
			throw new CreditRequestError(`Film ${index + 1} must be an object.`);
		}

		let id;
		if (preserveSuppliedIds && film.id !== undefined && film.id !== null && film.id !== "") {
			id = requireCreditId(film.id, "film");
		} else {
			id = crypto.randomUUID();
		}
		if (seenIds.has(id)) {
			throw new CreditRequestError("Film IDs must be unique within a category.");
		}
		seenIds.add(id);

		return {
			id,
			name: normalizeFilmName(film.name),
			link: normalizeCreditLink(film.link),
		};
	});
};

export const readCreditPayload = async (request) => {
	const contentType = request.headers.get("Content-Type") || "";
	if (!contentType.includes("application/json")) {
		throw new CreditRequestError("Use JSON for credit requests.", 415);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		throw new CreditRequestError("Invalid JSON.");
	}
	if (!isObject(body)) {
		throw new CreditRequestError("The request body must be an object.");
	}
	return body;
};

export const normalizeCreditCategoryInput = (
	payload,
	{ preserveFilmIds = false } = {},
) => {
	if (!isObject(payload)) {
		throw new CreditRequestError("The credit category must be an object.");
	}
	return {
		position: normalizeCreditPosition(payload.position),
		color: normalizeCreditColor(payload.color),
		films: normalizeCreditFilms(payload.films, {
			preserveSuppliedIds: preserveFilmIds,
		}),
	};
};

export const assertUniqueCreditPositions = (categories, exceptId = null) => {
	const positions = new Map();
	for (const category of categories) {
		if (category.id === exceptId) continue;
		const key = creditPositionKey(category.position);
		if (positions.has(key)) {
			throw new CreditRequestError(
				`The position “${category.position}” already exists.`,
				409,
			);
		}
		positions.set(key, category.id);
	}
};

export const assertUniqueCreditIds = (categories) => {
	const categoryIds = new Set();
	const filmIds = new Set();
	for (const category of categories) {
		const categoryId = requireCreditId(category?.id);
		if (categoryIds.has(categoryId)) {
			throw new CreditRequestError("Credit category IDs must be unique.");
		}
		categoryIds.add(categoryId);

		if (!Array.isArray(category?.films)) {
			throw new CreditRequestError("Credit category films must be an array.");
		}
		for (const film of category.films) {
			const filmId = requireCreditId(film?.id, "film");
			if (filmIds.has(filmId)) {
				throw new CreditRequestError("Film IDs must be unique.");
			}
			filmIds.add(filmId);
		}
	}
};

const isValidTimestamp = (value) => {
	if (typeof value !== "string" || !value) return false;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};

const normalizeStoredDocument = (value) => {
	if (!isObject(value) || value.schemaVersion !== CREDITS_SCHEMA_VERSION) {
		throw new Error("The stored credits document has an unsupported schema.");
	}
	if (
		!Array.isArray(value.categories) ||
		value.categories.length > MAX_CREDIT_CATEGORIES
	) {
		throw new Error("The stored credits document has invalid categories.");
	}
	if (!isValidTimestamp(value.updatedAt)) {
		throw new Error("The stored credits document has an invalid timestamp.");
	}

	const categoryIds = new Set();
	const filmIds = new Set();
	const positions = new Set();
	const categories = value.categories.map((category) => {
		try {
			if (!isObject(category)) {
				throw new CreditRequestError("Invalid category.");
			}
			const id = requireCreditId(category.id);
			if (categoryIds.has(id)) {
				throw new CreditRequestError("Credit category IDs must be unique.");
			}
			categoryIds.add(id);

			const position = normalizeCreditPosition(category.position);
			const positionKey = position.toLocaleLowerCase("en-US");
			if (positions.has(positionKey)) {
				throw new CreditRequestError("Credit positions must be unique.");
			}
			positions.add(positionKey);

			if (!Array.isArray(category.films) || category.films.length === 0) {
				throw new CreditRequestError("Invalid films.");
			}
			if (category.films.length > MAX_CREDIT_FILMS_PER_CATEGORY) {
				throw new CreditRequestError("Too many films.");
			}
			const films = category.films.map((film) => {
				if (!isObject(film)) {
					throw new CreditRequestError("Invalid film.");
				}
				const filmId = requireCreditId(film.id, "film");
				if (filmIds.has(filmId)) {
					throw new CreditRequestError("Film IDs must be unique.");
				}
				filmIds.add(filmId);
				return {
					id: filmId,
					name: normalizeFilmName(film.name),
					link: normalizeCreditLink(film.link),
				};
			});

			if (!isValidTimestamp(category.createdAt) || !isValidTimestamp(category.updatedAt)) {
				throw new CreditRequestError("Invalid category timestamp.");
			}

			return {
				id,
				position,
				color: normalizeCreditColor(category.color),
				films,
				createdAt: category.createdAt,
				updatedAt: category.updatedAt,
			};
		} catch (error) {
			throw new Error("The stored credits document is invalid.", {
				cause: error,
			});
		}
	});

	return {
		schemaVersion: CREDITS_SCHEMA_VERSION,
		categories,
		updatedAt: value.updatedAt,
	};
};

export const readCreditsDocument = async (kv) => {
	const stored = await kv.get(CREDITS_KEY, "json");
	if (stored === null || stored === undefined) {
		return {
			schemaVersion: CREDITS_SCHEMA_VERSION,
			categories: [],
			updatedAt: null,
		};
	}
	return normalizeStoredDocument(stored);
};

export const writeCreditsDocument = async (kv, categories) => {
	if (!Array.isArray(categories) || categories.length > MAX_CREDIT_CATEGORIES) {
		throw new CreditRequestError(
			`At most ${MAX_CREDIT_CATEGORIES} credit categories are allowed.`,
		);
	}
	assertUniqueCreditIds(categories);
	assertUniqueCreditPositions(categories);

	const timestamp = new Date().toISOString();
	const document = {
		schemaVersion: CREDITS_SCHEMA_VERSION,
		categories,
		updatedAt: timestamp,
	};
	// Validate the exact shape before it reaches persistent storage.
	normalizeStoredDocument(document);
	await kv.put(CREDITS_KEY, JSON.stringify(document));
	return document;
};

export const toPublicCreditCategory = (category) => ({
	id: category.id,
	position: category.position,
	color: category.color,
	films: category.films.map((film) => ({
		id: film.id,
		name: film.name,
		link: film.link,
	})),
});
