export const BIOGRAPHY_MAX_LENGTH = 5000;

const MAX_DOCUMENT_BYTES = 80000;
const MAX_BLOCKS = 120;
const MAX_INLINE_RUNS = 1000;
const MAX_LIST_ITEMS = 120;
const textBlockTypes = new Set(["paragraph", "heading2", "heading3", "quote"]);
const listBlockTypes = new Set(["bulletList", "numberedList"]);
const alignments = new Set(["left", "center", "right"]);

const isRecord = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeBiographyLink = (value) => {
	if (typeof value !== "string") return null;
	const link = value.trim();
	if (!link || link.length > 2048 || /[\u0000-\u001F\u007F]/.test(link)) {
		return null;
	}
	if (link.startsWith("/") && !link.startsWith("//") && !link.includes("\\")) {
		return link;
	}

	try {
		const url = new URL(link);
		return url.protocol === "https:" && !url.username && !url.password
			? url.href
			: null;
	} catch {
		return null;
	}
};

const normalizeInlineList = (value) => {
	if (!Array.isArray(value) || value.length > MAX_INLINE_RUNS) return null;
	const content = [];
	for (const candidate of value) {
		if (
			!isRecord(candidate) ||
			typeof candidate.text !== "string" ||
			candidate.text.length > BIOGRAPHY_MAX_LENGTH
		) {
			return null;
		}
		const inline = { text: candidate.text };
		if (candidate.bold === true) inline.bold = true;
		if (candidate.italic === true) inline.italic = true;
		if (candidate.underline === true) inline.underline = true;
		if (candidate.strike === true) inline.strike = true;
		if (candidate.link !== undefined) {
			const link = normalizeBiographyLink(candidate.link);
			if (!link) return null;
			inline.link = link;
		}
		content.push(inline);
	}
	return content;
};

export const normalizeBiographyDocument = (value) => {
	if (
		!isRecord(value) ||
		value.version !== 1 ||
		!Array.isArray(value.blocks) ||
		value.blocks.length === 0 ||
		value.blocks.length > MAX_BLOCKS
	) {
		return null;
	}

	try {
		if (JSON.stringify(value).length > MAX_DOCUMENT_BYTES) return null;
	} catch {
		return null;
	}

	const blocks = [];
	for (const candidate of value.blocks) {
		if (!isRecord(candidate) || typeof candidate.type !== "string") return null;
		const align = alignments.has(candidate.align) ? candidate.align : "center";

		if (textBlockTypes.has(candidate.type)) {
			const content = normalizeInlineList(candidate.content);
			if (!content) return null;
			blocks.push({ type: candidate.type, align, content });
			continue;
		}

		if (listBlockTypes.has(candidate.type)) {
			if (
				!Array.isArray(candidate.items) ||
				candidate.items.length > MAX_LIST_ITEMS
			) {
				return null;
			}
			const items = [];
			for (const item of candidate.items) {
				const content = normalizeInlineList(item);
				if (!content) return null;
				items.push(content);
			}
			blocks.push({ type: candidate.type, align, items });
			continue;
		}

		return null;
	}

	return { version: 1, blocks };
};

const inlineText = (content) => content.map((run) => run.text).join("");

export const biographyDocumentToText = (document) =>
	document.blocks
		.map((block) =>
			Array.isArray(block.items)
				? block.items.map((item) => inlineText(item)).join("\n")
				: inlineText(block.content),
		)
		.join("\n\n")
		.trim();

export const biographyDocumentFromText = (value) => {
	const biography = value.trim();
	return {
		version: 1,
		blocks: (biography ? biography.split(/\n{2,}/) : [""]).map((text) => ({
			type: "paragraph",
			align: "center",
			content: [{ text }],
		})),
	};
};
