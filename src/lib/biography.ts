export const BIOGRAPHY_MAX_LENGTH = 5000;

const MAX_DOCUMENT_BYTES = 80000;
const MAX_BLOCKS = 120;
const MAX_INLINE_RUNS = 1000;
const MAX_LIST_ITEMS = 120;

export type BiographyAlignment = "left" | "center" | "right";
export type BiographyTextBlockType =
	| "paragraph"
	| "heading2"
	| "heading3"
	| "quote";
export type BiographyListBlockType = "bulletList" | "numberedList";

export type BiographyInline = {
	text: string;
	bold?: true;
	italic?: true;
	underline?: true;
	strike?: true;
	link?: string;
};

export type BiographyTextBlock = {
	type: BiographyTextBlockType;
	align: BiographyAlignment;
	content: BiographyInline[];
};

export type BiographyListBlock = {
	type: BiographyListBlockType;
	align: BiographyAlignment;
	items: BiographyInline[][];
};

export type BiographyBlock = BiographyTextBlock | BiographyListBlock;

export type BiographyDocument = {
	version: 1;
	blocks: BiographyBlock[];
};

const textBlockTypes = new Set<BiographyTextBlockType>([
	"paragraph",
	"heading2",
	"heading3",
	"quote",
]);
const listBlockTypes = new Set<BiographyListBlockType>([
	"bulletList",
	"numberedList",
]);
const alignments = new Set<BiographyAlignment>(["left", "center", "right"]);
const blockTags = new Set(["P", "DIV", "H2", "H3", "BLOCKQUOTE", "UL", "OL"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeBiographyLink = (value: unknown) => {
	if (typeof value !== "string") return null;
	const link = value.trim();
	if (
		!link ||
		link.length > 2048 ||
		/[\u0000-\u001F\u007F]/.test(link)
	) {
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

const normalizeInline = (value: unknown): BiographyInline | null => {
	if (
		!isRecord(value) ||
		typeof value.text !== "string" ||
		value.text.length > BIOGRAPHY_MAX_LENGTH
	) {
		return null;
	}

	const inline: BiographyInline = { text: value.text };
	if (value.bold === true) inline.bold = true;
	if (value.italic === true) inline.italic = true;
	if (value.underline === true) inline.underline = true;
	if (value.strike === true) inline.strike = true;
	if (value.link !== undefined) {
		const link = normalizeBiographyLink(value.link);
		if (!link) return null;
		inline.link = link;
	}
	return inline;
};

const sameInlineFormatting = (left: BiographyInline, right: BiographyInline) =>
	left.bold === right.bold &&
	left.italic === right.italic &&
	left.underline === right.underline &&
	left.strike === right.strike &&
	left.link === right.link;

const mergeInlineRuns = (runs: BiographyInline[]) => {
	const merged: BiographyInline[] = [];
	for (const run of runs) {
		const previous = merged.at(-1);
		if (previous && sameInlineFormatting(previous, run)) {
			previous.text += run.text;
		} else {
			merged.push({ ...run });
		}
	}
	return merged;
};

const normalizeInlineList = (value: unknown): BiographyInline[] | null => {
	if (!Array.isArray(value) || value.length > MAX_INLINE_RUNS) return null;
	const runs: BiographyInline[] = [];
	for (const item of value) {
		const run = normalizeInline(item);
		if (!run) return null;
		runs.push(run);
	}
	return mergeInlineRuns(runs);
};

export const normalizeBiographyDocument = (
	value: unknown,
): BiographyDocument | null => {
	if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks)) {
		return null;
	}
	if (value.blocks.length === 0 || value.blocks.length > MAX_BLOCKS) return null;

	try {
		if (JSON.stringify(value).length > MAX_DOCUMENT_BYTES) return null;
	} catch {
		return null;
	}

	const blocks: BiographyBlock[] = [];
	for (const candidate of value.blocks) {
		if (!isRecord(candidate) || typeof candidate.type !== "string") return null;
		const align = alignments.has(candidate.align as BiographyAlignment)
			? (candidate.align as BiographyAlignment)
			: "center";

		if (textBlockTypes.has(candidate.type as BiographyTextBlockType)) {
			const content = normalizeInlineList(candidate.content);
			if (!content) return null;
			blocks.push({
				type: candidate.type as BiographyTextBlockType,
				align,
				content,
			});
			continue;
		}

		if (listBlockTypes.has(candidate.type as BiographyListBlockType)) {
			if (
				!Array.isArray(candidate.items) ||
				candidate.items.length > MAX_LIST_ITEMS
			) {
				return null;
			}
			const items: BiographyInline[][] = [];
			for (const item of candidate.items) {
				const content = normalizeInlineList(item);
				if (!content) return null;
				items.push(content);
			}
			blocks.push({
				type: candidate.type as BiographyListBlockType,
				align,
				items,
			});
			continue;
		}

		return null;
	}

	const document: BiographyDocument = { version: 1, blocks };
	return biographyDocumentToText(document).length <= BIOGRAPHY_MAX_LENGTH
		? document
		: null;
};

const inlineText = (content: BiographyInline[]) =>
	content.map((run) => run.text).join("");

export const biographyDocumentToText = (document: BiographyDocument) =>
	document.blocks
		.map((block) =>
			"items" in block
				? block.items.map((item) => inlineText(item)).join("\n")
				: inlineText(block.content),
		)
		.join("\n\n")
		.trim();

export const biographyDocumentFromText = (
	value: string,
	align: BiographyAlignment = "center",
): BiographyDocument => {
	const biography = value.trim();
	const paragraphs = biography ? biography.split(/\n{2,}/) : [""];
	return {
		version: 1,
		blocks: paragraphs.map((text) => ({
			type: "paragraph",
			align,
			content: [{ text }],
		})),
	};
};

const appendInlineContent = (
	target: HTMLElement,
	content: BiographyInline[],
	linksOpenInNewTab: boolean,
) => {
	if (content.length === 0 || content.every((run) => run.text === "")) {
		target.append(document.createElement("br"));
		return;
	}

	for (const run of content) {
		let node: Node = document.createTextNode(run.text);
		if (run.bold) {
			const strong = document.createElement("strong");
			strong.append(node);
			node = strong;
		}
		if (run.italic) {
			const emphasis = document.createElement("em");
			emphasis.append(node);
			node = emphasis;
		}
		if (run.underline) {
			const underline = document.createElement("u");
			underline.append(node);
			node = underline;
		}
		if (run.strike) {
			const strike = document.createElement("s");
			strike.append(node);
			node = strike;
		}
		if (run.link) {
			const anchor = document.createElement("a");
			anchor.href = run.link;
			if (linksOpenInNewTab) {
				anchor.target = "_blank";
				anchor.rel = "noopener noreferrer";
			}
			anchor.append(node);
			node = anchor;
		}
		target.append(node);
	}
};

export const renderBiographyDocument = (
	target: HTMLElement,
	documentValue: BiographyDocument,
	options: { linksOpenInNewTab?: boolean } = {},
) => {
	const fragment = document.createDocumentFragment();
	for (const block of documentValue.blocks) {
		if ("items" in block) {
			const list = document.createElement(
				block.type === "numberedList" ? "ol" : "ul",
			);
			list.style.textAlign = block.align;
			for (const item of block.items) {
				const listItem = document.createElement("li");
				appendInlineContent(
					listItem,
					item,
					options.linksOpenInNewTab === true,
				);
				list.append(listItem);
			}
			fragment.append(list);
			continue;
		}

		const tag =
			block.type === "heading2"
				? "h2"
				: block.type === "heading3"
					? "h3"
					: block.type === "quote"
						? "blockquote"
						: "p";
		const element = document.createElement(tag);
		element.style.textAlign = block.align;
		appendInlineContent(
			element,
			block.content,
			options.linksOpenInNewTab === true,
		);
		fragment.append(element);
	}
	target.replaceChildren(fragment);
};

type InlineMarks = Omit<BiographyInline, "text">;

const readElementMarks = (element: HTMLElement, inherited: InlineMarks) => {
	const marks: InlineMarks = { ...inherited };
	const tag = element.tagName;
	const fontWeight = element.style.fontWeight;
	const decoration = element.style.textDecorationLine || element.style.textDecoration;
	if (
		tag === "B" ||
		tag === "STRONG" ||
		fontWeight === "bold" ||
		Number.parseInt(fontWeight, 10) >= 600
	) {
		marks.bold = true;
	}
	if (tag === "I" || tag === "EM" || element.style.fontStyle === "italic") {
		marks.italic = true;
	}
	if (tag === "U" || decoration.includes("underline")) marks.underline = true;
	if (tag === "S" || tag === "STRIKE" || decoration.includes("line-through")) {
		marks.strike = true;
	}
	if (tag === "A") {
		const link = normalizeBiographyLink(element.getAttribute("href"));
		if (link) marks.link = link;
	}
	return marks;
};

const readInlineNodes = (
	nodes: Iterable<ChildNode>,
	inherited: InlineMarks = {},
): BiographyInline[] => {
	const runs: BiographyInline[] = [];
	for (const node of nodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			runs.push({ text: node.textContent ?? "", ...inherited });
			continue;
		}
		if (!(node instanceof HTMLElement)) continue;
		if (node.tagName === "BR") {
			runs.push({ text: "\n", ...inherited });
			continue;
		}
		const marks = readElementMarks(node, inherited);
		runs.push(...readInlineNodes(node.childNodes, marks));
	}
	return mergeInlineRuns(runs);
};

const getAlignment = (element: HTMLElement): BiographyAlignment => {
	const alignment = element.style.textAlign || getComputedStyle(element).textAlign;
	return alignments.has(alignment as BiographyAlignment)
		? (alignment as BiographyAlignment)
		: "center";
};

const hasDirectBlockChildren = (element: HTMLElement) =>
	Array.from(element.children).some((child) => blockTags.has(child.tagName));

export const serializeBiographyEditor = (
	editor: HTMLElement,
): BiographyDocument => {
	const blocks: BiographyBlock[] = [];

	const appendParagraph = (
		nodes: ChildNode[],
		container: HTMLElement,
		preserveEmpty = true,
	) => {
		if (nodes.length === 0) return;
		const content = readInlineNodes(nodes);
		if (!preserveEmpty && !inlineText(content).trim()) return;
		blocks.push({
			type: "paragraph",
			align: getAlignment(container),
			content,
		});
	};

	const visit = (container: HTMLElement) => {
		const containsNestedBlocks = hasDirectBlockChildren(container);
		let inlineNodes: ChildNode[] = [];
		const flushInline = () => {
			appendParagraph(inlineNodes, container, !containsNestedBlocks);
			inlineNodes = [];
		};

		for (const node of Array.from(container.childNodes)) {
			if (!(node instanceof HTMLElement) || !blockTags.has(node.tagName)) {
				inlineNodes.push(node);
				continue;
			}
			flushInline();

			if (node.tagName === "UL" || node.tagName === "OL") {
				blocks.push({
					type: node.tagName === "OL" ? "numberedList" : "bulletList",
					align: getAlignment(node),
					items: Array.from(node.children)
						.filter((child) => child.tagName === "LI")
						.map((item) => readInlineNodes(item.childNodes)),
				});
				continue;
			}

			if (hasDirectBlockChildren(node)) {
				visit(node);
				continue;
			}

			const type: BiographyTextBlockType =
				node.tagName === "H2"
					? "heading2"
					: node.tagName === "H3"
						? "heading3"
						: node.tagName === "BLOCKQUOTE"
							? "quote"
							: "paragraph";
			blocks.push({
				type,
				align: getAlignment(node),
				content: readInlineNodes(node.childNodes),
			});
		}
		flushInline();
	};

	visit(editor);
	return {
		version: 1,
		blocks:
			blocks.length > 0
				? blocks
				: [{ type: "paragraph", align: "center", content: [] }],
	};
};
