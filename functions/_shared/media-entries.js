export const MEDIA_ENTRY_SECTIONS = new Set([
	"featured",
	"interviews",
	"behind-the-scenes",
	"press",
	"acting",
	"film",
	"video",
]);

export const MAX_MEDIA_ENTRIES_PER_SECTION = 200;
export const MAX_MEDIA_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_MEDIA_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export const ATTACHMENT_ENTRY_SECTIONS = MEDIA_ENTRY_SECTIONS;

export const FEATURED_PROMOTION_SECTIONS = new Set([
	"interviews",
	"behind-the-scenes",
	"press",
]);

const IMAGE_TYPES = new Map([
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
	["image/avif", "avif"],
]);

const ATTACHMENT_TYPES = new Map([
	...IMAGE_TYPES,
	["image/gif", "gif"],
	["video/mp4", "mp4"],
	["video/webm", "webm"],
	["video/ogg", "ogv"],
	["video/quicktime", "mov"],
	["application/pdf", "pdf"],
	["audio/mpeg", "mp3"],
	["audio/mp4", "m4a"],
	["audio/ogg", "ogg"],
	["audio/wav", "wav"],
	["text/plain", "txt"],
	["application/zip", "zip"],
	["application/msword", "doc"],
	[
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"docx",
	],
	["application/vnd.ms-excel", "xls"],
	[
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"xlsx",
	],
	["application/vnd.ms-powerpoint", "ppt"],
	[
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"pptx",
	],
]);

export class MediaEntryRequestError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.name = "MediaEntryRequestError";
		this.status = status;
	}
}

export const mediaEntryPrefix = (section) => `media-entry:${section}:`;

export const mediaEntryKey = (section, id) =>
	`${mediaEntryPrefix(section)}${id}`;

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

export const normalizeMediaSection = (value) => {
	const section = String(value || "");
	return MEDIA_ENTRY_SECTIONS.has(section) ? section : null;
};

const isObject = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isFileLike = (value) =>
	isObject(value) &&
	typeof value.name === "string" &&
	typeof value.type === "string" &&
	typeof value.size === "number" &&
	typeof value.stream === "function";

const readTextField = (source, name) => {
	const value = source instanceof FormData ? source.get(name) : source[name];
	return typeof value === "string" ? value : "";
};

export const readMediaEntryPayload = async (request) => {
	const contentType = request.headers.get("Content-Type") || "";

	if (
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded")
	) {
		let form;
		try {
			form = await request.formData();
		} catch {
			throw new MediaEntryRequestError("Invalid form data.");
		}

		const imageField = form.get("image");
		const image =
			imageField === "" ||
			(isFileLike(imageField) && imageField.size === 0)
				? null
				: imageField;
		const attachmentField = form.get("attachment");
		const attachment =
			attachmentField === "" ||
			(isFileLike(attachmentField) && attachmentField.size === 0)
				? null
				: attachmentField;

		return {
			id: readTextField(form, "id"),
			title: readTextField(form, "title"),
			description: readTextField(form, "description"),
			date: readTextField(form, "date"),
			link: readTextField(form, "link"),
			imageAlt: readTextField(form, "imageAlt"),
			image,
			attachmentAlt: readTextField(form, "attachmentAlt"),
			attachment,
			removeAttachment:
				readTextField(form, "removeAttachment") === "true" ||
				readTextField(form, "removeAttachment") === "on",
		};
	}

	if (contentType.includes("application/json")) {
		let body;
		try {
			body = await request.json();
		} catch {
			throw new MediaEntryRequestError("Invalid JSON.");
		}
		if (!isObject(body)) {
			throw new MediaEntryRequestError("The request body must be an object.");
		}

		return {
			id: readTextField(body, "id"),
			title: readTextField(body, "title"),
			description: readTextField(body, "description"),
			date: readTextField(body, "date"),
			link: readTextField(body, "link"),
			imageAlt: readTextField(body, "imageAlt"),
			image: null,
			attachmentAlt: readTextField(body, "attachmentAlt"),
			attachment: null,
			removeAttachment: Boolean(body.removeAttachment),
		};
	}

	throw new MediaEntryRequestError(
		"Use multipart form data for media entries.",
		415,
	);
};

const isValidCalendarDate = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const timestamp = Date.parse(`${value}T00:00:00.000Z`);
	return (
		Number.isFinite(timestamp) &&
		new Date(timestamp).toISOString().slice(0, 10) === value
	);
};

const normalizeHttpsLink = (value, required) => {
	const link = value.trim();
	if (!link) {
		if (required) {
			throw new MediaEntryRequestError(
				"An HTTPS link is required for this section.",
			);
		}
		return null;
	}
	if (link.length > 2048) {
		throw new MediaEntryRequestError("The link must be 2,048 characters or fewer.");
	}

	let url;
	try {
		url = new URL(link);
	} catch {
		throw new MediaEntryRequestError("Enter a valid HTTPS link.");
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password
	) {
		throw new MediaEntryRequestError(
			"The link must use HTTPS and cannot contain a username or password.",
		);
	}
	return url.href;
};

export const validateMediaEntryMetadata = (section, payload) => {
	const title = payload.title.trim();
	const description = payload.description.trim();
	const date = payload.date.trim();
	const imageAltInput = payload.imageAlt.trim();
	const attachmentAltInput = payload.attachmentAlt.trim();
	const linkInput = payload.link.trim();

	if (!title || title.length > 120) {
		throw new MediaEntryRequestError(
			"Title must be between 1 and 120 characters.",
		);
	}
	if (!description || description.length > 800) {
		throw new MediaEntryRequestError(
			"Description must be between 1 and 800 characters.",
		);
	}
	if (!isValidCalendarDate(date)) {
		throw new MediaEntryRequestError("Date must be a valid YYYY-MM-DD date.");
	}
	if (imageAltInput.length > 180) {
		throw new MediaEntryRequestError(
			"Image description must be 180 characters or fewer.",
		);
	}
	if (attachmentAltInput.length > 180) {
		throw new MediaEntryRequestError(
			"Attachment description must be 180 characters or fewer.",
		);
	}
	if (
		section === "behind-the-scenes" &&
		payload.image !== null &&
		!imageAltInput
	) {
		throw new MediaEntryRequestError(
			"Add an image description when uploading a behind-the-scenes photo.",
		);
	}
	if (section === "behind-the-scenes" && linkInput) {
		throw new MediaEntryRequestError(
			"Behind-the-scenes entries use an uploaded image instead of a link.",
		);
	}

	return {
		title,
		description,
		date,
		link:
			section === "behind-the-scenes"
				? null
				: normalizeHttpsLink(
						linkInput,
						section === "interviews" || section === "press",
					),
		imageAlt: section === "behind-the-scenes" ? imageAltInput : null,
		attachmentAlt: ATTACHMENT_ENTRY_SECTIONS.has(section)
			? attachmentAltInput
			: null,
	};
};

export const validateMediaImage = (file, { required = false } = {}) => {
	if (file === null || file === undefined) {
		if (required) {
			throw new MediaEntryRequestError(
				"Choose an image for this behind-the-scenes entry.",
			);
		}
		return null;
	}
	if (!isFileLike(file)) {
		throw new MediaEntryRequestError("The image upload is invalid.");
	}

	const contentType = file.type.toLowerCase();
	const extension = IMAGE_TYPES.get(contentType);
	if (!extension) {
		throw new MediaEntryRequestError(
			"Images must be JPEG, PNG, WebP, or AVIF.",
			415,
		);
	}
	if (file.size <= 0 || file.size > MAX_MEDIA_IMAGE_BYTES) {
		throw new MediaEntryRequestError(
			"Images must be no larger than 15 MB.",
			413,
		);
	}

	return { file, contentType, extension };
};

export const validateMediaAttachment = (file) => {
	if (file === null || file === undefined) return null;
	if (!isFileLike(file)) {
		throw new MediaEntryRequestError("The attachment upload is invalid.");
	}

	const contentType = file.type.toLowerCase();
	const extension = ATTACHMENT_TYPES.get(contentType);
	if (!extension) {
		throw new MediaEntryRequestError(
			"That attachment type is not supported. Use an image, browser-playable video or audio file, PDF, text document, Office document, or ZIP archive.",
			415,
		);
	}
	if (file.size <= 0 || file.size > MAX_MEDIA_ATTACHMENT_BYTES) {
		throw new MediaEntryRequestError(
			"Attachments must be no larger than 100 MB.",
			413,
		);
	}

	return {
		file,
		contentType,
		extension,
		originalName: file.name.slice(0, 180),
	};
};

export const putMediaEntryImage = async ({
	env,
	section,
	entryId,
	validatedImage,
}) => {
	if (!env.MEDIA_BUCKET) {
		throw new MediaEntryRequestError(
			"MEDIA_BUCKET binding is missing.",
			503,
		);
	}

	const { file, contentType, extension } = validatedImage;
	const key = `entry-${section}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
	await env.MEDIA_BUCKET.put(key, file.stream(), {
		httpMetadata: { contentType },
		customMetadata: {
			entryId,
			section,
			originalName: file.name.slice(0, 180),
		},
	});
	return { imageKey: key, imageType: contentType };
};

export const putMediaEntryAttachment = async ({
	env,
	section,
	entryId,
	validatedAttachment,
}) => {
	if (!env.MEDIA_BUCKET) {
		throw new MediaEntryRequestError(
			"MEDIA_BUCKET binding is missing.",
			503,
		);
	}

	const { file, contentType, extension, originalName } = validatedAttachment;
	const key = `entry-${section}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
	await env.MEDIA_BUCKET.put(key, file.stream(), {
		httpMetadata: { contentType },
		customMetadata: {
			entryId,
			section,
			originalName,
			kind: "attachment",
		},
	});
	return {
		attachmentKey: key,
		attachmentType: contentType,
		attachmentName: originalName,
	};
};

export const deleteMediaEntryImage = async (env, key) => {
	if (!key || !env.MEDIA_BUCKET) return false;
	try {
		await env.MEDIA_BUCKET.delete(key);
		return true;
	} catch (error) {
		console.error("Could not delete media entry image.", error);
		return false;
	}
};

const validateStoredMediaEntry = (entry, section) => {
	if (!isObject(entry) || typeof entry.id !== "string" || !entry.id) {
		throw new Error(`Invalid media entry in ${section}.`);
	}
	return entry;
};

export const listMediaEntryKeys = async (kv, section) => {
	const result = await kv.list({
		prefix: mediaEntryPrefix(section),
		limit: MAX_MEDIA_ENTRIES_PER_SECTION + 1,
	});
	return Array.isArray(result.keys) ? result.keys : [];
};

export const readMediaEntries = async (kv, section) => {
	const keys = await listMediaEntryKeys(kv, section);
	const names = keys.map((key) => key.name);
	const storedEntries = [];

	for (let index = 0; index < names.length; index += 100) {
		const chunk = names.slice(index, index + 100);
		const bulkResult = await kv.get(chunk, "json");
		if (bulkResult instanceof Map) {
			for (const name of chunk) storedEntries.push(bulkResult.get(name));
		} else {
			// Keep compatibility with local and test KV implementations that do not
			// expose Cloudflare's bulk-read overload yet.
			storedEntries.push(
				...(await Promise.all(chunk.map((name) => kv.get(name, "json")))),
			);
		}
	}

	return storedEntries
		.filter((entry) => entry !== null && entry !== undefined)
		.map((entry) => validateStoredMediaEntry(entry, section));
};

export const readMediaEntry = async (kv, section, id) => {
	const entry = await kv.get(mediaEntryKey(section, id), "json");
	return entry === null ? null : validateStoredMediaEntry(entry, section);
};

export const writeMediaEntry = async (kv, section, entry) => {
	await kv.put(mediaEntryKey(section, entry.id), JSON.stringify(entry));
};

export const removeMediaEntry = async (kv, section, id) => {
	await kv.delete(mediaEntryKey(section, id));
};

export const sortMediaEntriesNewest = (entries) =>
	[...entries].sort((left, right) => {
		const dateOrder = String(right.date || "").localeCompare(
			String(left.date || ""),
		);
		if (dateOrder) return dateOrder;
		return String(right.createdAt || "").localeCompare(
			String(left.createdAt || ""),
		);
	});

const stringOrEmpty = (value) => (typeof value === "string" ? value : "");
const stringOrNull = (value) =>
	typeof value === "string" && value ? value : null;

export const mediaImageUrl = (key) =>
	typeof key === "string" && key
		? `/api/media/${encodeURIComponent(key)}`
		: null;

export const toAdminMediaEntry = (entry) => ({
	id: stringOrEmpty(entry.id),
	section: stringOrEmpty(entry.section),
	title: stringOrEmpty(entry.title),
	description: stringOrEmpty(entry.description),
	date: stringOrEmpty(entry.date),
	link: stringOrNull(entry.link),
	imageAlt: stringOrEmpty(entry.imageAlt),
	imageKey: stringOrNull(entry.imageKey),
	imageType: stringOrNull(entry.imageType),
	imageUrl: mediaImageUrl(entry.imageKey),
	attachmentAlt: stringOrEmpty(entry.attachmentAlt),
	attachmentKey: stringOrNull(entry.attachmentKey),
	attachmentType: stringOrNull(entry.attachmentType),
	attachmentName: stringOrNull(entry.attachmentName),
	attachmentUrl: mediaImageUrl(entry.attachmentKey),
	featured: entry.featured === true,
	createdAt: stringOrEmpty(entry.createdAt),
	updatedAt: stringOrEmpty(entry.updatedAt),
});

export const toPublicMediaEntry = (entry) => ({
	id: stringOrEmpty(entry.id),
	section: stringOrEmpty(entry.section),
	title: stringOrEmpty(entry.title),
	description: stringOrEmpty(entry.description),
	date: stringOrEmpty(entry.date),
	link: stringOrNull(entry.link),
	imageAlt: stringOrEmpty(entry.imageAlt),
	imageUrl: mediaImageUrl(entry.imageKey),
	attachmentAlt: stringOrEmpty(entry.attachmentAlt),
	attachmentType: stringOrNull(entry.attachmentType),
	attachmentName: stringOrNull(entry.attachmentName),
	attachmentUrl: mediaImageUrl(entry.attachmentKey),
	featured: entry.featured === true,
	createdAt: stringOrEmpty(entry.createdAt),
});
