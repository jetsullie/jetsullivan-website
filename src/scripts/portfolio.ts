import { createArrow } from "./arrow";
	import { setupPostDialog } from "./post-dialog";

	interface PortfolioEntry {
		id?: string;
		title?: string;
		description?: string;
		date?: string;
		link?: string | null;
		attachmentUrl?: string | null;
		attachmentType?: string | null;
		attachmentName?: string | null;
		attachmentAlt?: string | null;
		createdAt?: string;
	}

	type EntryMode = "preview" | "detail";

	const postDialog = setupPostDialog();
	let postSequence = 0;

	const safeWebUrl = (value: unknown) => {
		if (typeof value !== "string" || !value.trim()) return null;

		try {
			const url = new URL(value, window.location.origin);
			const isSameOrigin = url.origin === window.location.origin;
			return url.protocol === "https:" ||
				(isSameOrigin && url.protocol === "http:")
				? url
				: null;
		} catch {
			return null;
		}
	};

	const formatDate = (value: unknown) => {
		if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return null;
		}
		const date = new Date(`${value}T12:00:00`);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		}).format(date);
	};

	const createStatusCard = (message: string, isError = false) => {
		const card = document.createElement("article");
		const copy = document.createElement("p");
		card.className = `info-window status-card${isError ? " error-card" : ""}`;
		copy.textContent = message;
		card.append(copy);
		return card;
	};

	const createAttachment = (
		entry: PortfolioEntry,
		title: string,
		mode: EntryMode,
	) => {
		const attachmentUrl = safeWebUrl(entry.attachmentUrl);
		if (!attachmentUrl) return null;

		const type =
			typeof entry.attachmentType === "string" ? entry.attachmentType : "";
		const name =
			(typeof entry.attachmentName === "string" &&
				entry.attachmentName.trim()) ||
			"Attached file";
		const frame = document.createElement("div");
		frame.className = `entry-attachment${
			mode === "preview" ? " attachment-preview" : ""
		}`;

		if (type.startsWith("image/")) {
			const image = document.createElement("img");
			image.src = attachmentUrl.href;
			image.alt =
				(typeof entry.attachmentAlt === "string" &&
					entry.attachmentAlt.trim()) ||
				title;
			image.loading = "lazy";
			image.decoding = "async";
			frame.append(image);
			return frame;
		}

		if (type.startsWith("video/")) {
			const video = document.createElement("video");
			video.src = attachmentUrl.href;
			video.preload = "metadata";
			video.playsInline = true;
			if (mode === "detail") {
				video.controls = true;
				video.setAttribute("aria-label", entry.attachmentAlt || title);
			} else {
				video.muted = true;
				video.tabIndex = -1;
				video.setAttribute("aria-hidden", "true");
			}
			frame.append(video);
			return frame;
		}

		if (mode === "preview") {
			const symbol = document.createElement("span");
			const kind = document.createElement("span");
			const filename = document.createElement("span");
			const isAudio = type.startsWith("audio/");
			const isPdf = type === "application/pdf";
			frame.classList.add("file-preview");
			symbol.className = "file-preview-symbol";
			kind.className = "file-preview-kind";
			filename.className = "file-preview-name";
			if (isAudio || isPdf) symbol.textContent = isAudio ? "♪" : "PDF";
			else symbol.append(createArrow());
			kind.textContent = isAudio ? "Audio" : isPdf ? "PDF" : "File";
			filename.textContent = name;
			frame.append(symbol, kind, filename);
			return frame;
		}

		if (type.startsWith("audio/")) {
			const audio = document.createElement("audio");
			audio.src = attachmentUrl.href;
			audio.controls = true;
			audio.preload = "metadata";
			audio.setAttribute("aria-label", entry.attachmentAlt || title);
			frame.classList.add("audio-attachment");
			frame.append(audio);
			return frame;
		}

		if (type === "application/pdf") {
			const viewer = document.createElement("iframe");
			const fallback = document.createElement("a");
			viewer.src = `${attachmentUrl.href}#view=FitH`;
			viewer.title = entry.attachmentAlt || `${title} PDF`;
			viewer.loading = "lazy";
			fallback.href = attachmentUrl.href;
			fallback.target = "_blank";
			fallback.rel = "noopener noreferrer";
			fallback.textContent = `Open ${name} in a new tab`;
			fallback.append(" ", createArrow());
			frame.classList.add("pdf-attachment");
			frame.append(viewer, fallback);
			return frame;
		}

		const fileLink = document.createElement("a");
		fileLink.href = attachmentUrl.href;
		fileLink.target = "_blank";
		fileLink.rel = "noopener noreferrer";
		fileLink.className = "attachment-file";
		fileLink.textContent = `Open ${name}`;
			fileLink.append(" ", createArrow());
		frame.classList.add("file-attachment");
		frame.append(fileLink);
		return frame;
	};

	const createEntryCard = (
		entry: PortfolioEntry,
		mode: EntryMode = "preview",
	) => {
		const card = document.createElement("article");
		const copy = document.createElement("div");
		const title = document.createElement("h2");
		const description = document.createElement("p");
		const formattedDate = formatDate(entry.date);
		const isDetail = mode === "detail";
		const sequence = ++postSequence;

		card.className = isDetail
			? "post-detail"
			: "info-window entry-card is-compact";
		copy.className = "entry-copy";
		title.textContent =
			typeof entry.title === "string" && entry.title.trim()
				? entry.title.trim()
				: "Untitled";
		description.textContent =
			typeof entry.description === "string" ? entry.description.trim() : "";

		const attachment = createAttachment(entry, title.textContent, mode);
		if (attachment) card.append(attachment);

		if (formattedDate && typeof entry.date === "string") {
			const time = document.createElement("time");
			time.dateTime = entry.date;
			time.textContent = formattedDate;
			copy.append(time);
		}

		copy.append(title);
		if (description.textContent) copy.append(description);

		const destination = safeWebUrl(entry.link);
		let previewLink: HTMLAnchorElement | null = null;
		if (destination) {
			const link = document.createElement("a");
			link.href = destination.href;
			link.className = "entry-link";
			link.textContent = "Open linked project";
			link.append(" ", createArrow());
			if (destination.origin !== window.location.origin) {
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.setAttribute(
					"aria-label",
					"Open linked project — opens in a new tab",
				);
			}
			if (isDetail) copy.append(link);
			else previewLink = link;
		}

		card.append(copy);

		if (!isDetail) {
			const actions = document.createElement("div");
			const hint = document.createElement("span");
			const openButton = document.createElement("button");
			actions.className = "entry-card-actions";
			hint.className = "entry-open-hint";
			hint.textContent = "View full post";
			if (previewLink) actions.append(previewLink);
			actions.append(hint);
			copy.append(actions);
			openButton.type = "button";
			openButton.className = "entry-open";
			openButton.setAttribute("aria-haspopup", "dialog");
			openButton.setAttribute(
				"aria-label",
				`Open full post: ${title.textContent}`,
			);
			openButton.addEventListener("click", () => {
				const detail = createEntryCard(entry, "detail");
				const detailTitle = detail.querySelector<HTMLHeadingElement>("h2");
				const detailDescription =
					detail.querySelector<HTMLParagraphElement>(".entry-copy > p");
				if (!detailTitle) return;
				const titleId = `portfolio-dialog-title-${sequence}`;
				const descriptionId = detailDescription
					? `portfolio-dialog-description-${sequence}`
					: undefined;
				detailTitle.id = titleId;
				if (detailDescription && descriptionId) {
					detailDescription.id = descriptionId;
				}
				postDialog.open(detail, openButton, titleId, descriptionId);
			});
			card.append(openButton);
		}

		return card;
	};

	document
		.querySelectorAll<HTMLElement>("[data-portfolio-entries]")
		.forEach(async (collection) => {
			const section = collection.dataset.section || "";
			const emptyMessage =
				collection.dataset.emptyMessage || "No posts have been added yet.";
			const status = collection.parentElement?.querySelector<HTMLElement>(
				"[data-entry-status]",
			);

			try {
				const response = await fetch(
					`/api/media-entries/${encodeURIComponent(section)}`,
				);
				if (!response.ok && response.status !== 404) {
					throw new Error("Request failed");
				}
				const result = response.ok ? await response.json() : { entries: [] };
				const entries = (
					Array.isArray(result.entries) ? result.entries : []
				) as PortfolioEntry[];
				entries.sort((left, right) =>
					`${right.date || ""}|${right.createdAt || ""}`.localeCompare(
						`${left.date || ""}|${left.createdAt || ""}`,
					),
				);
				collection.replaceChildren();

				if (!entries.length) {
					collection.append(createStatusCard(emptyMessage));
					if (status) status.textContent = emptyMessage;
				} else {
					for (const entry of entries) {
						collection.append(createEntryCard(entry));
					}
					if (status) {
						status.textContent = `${entries.length} ${
							entries.length === 1 ? "post" : "posts"
						} loaded.`;
					}
				}
			} catch {
				const message =
					"This collection is unavailable right now. Please try again soon.";
				collection.replaceChildren(createStatusCard(message, true));
				if (status) status.textContent = message;
			} finally {
				collection.setAttribute("aria-busy", "false");
			}
		});

import { initializeSiteMotion } from './site-motion';
initializeSiteMotion({canvasSelector:'.portfolio-page',titleSelector:'#page-heading',sectionSelector:'.portfolio-page,.social-header,.site-footer',stationarySelector:'.social-header,.site-footer'});
// Delegation also lights cards added after the collection request finishes.
document.addEventListener('pointermove', event => {
 const card = (event.target as Element).closest<HTMLElement>('.entry-card,.heading-card');
 if (!card) return;
 const rect = card.getBoundingClientRect();
 card.style.setProperty('--glass-light-x', `${(event.clientX-rect.left)/rect.width*100}%`);
 card.style.setProperty('--glass-light-y', `${(event.clientY-rect.top)/rect.height*100}%`);
});
