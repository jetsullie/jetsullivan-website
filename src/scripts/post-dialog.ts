export interface PostDialogController {
	open: (
		content: HTMLElement,
		opener: HTMLButtonElement,
		labelledBy: string,
		describedBy?: string,
	) => void;
}

const inactiveController: PostDialogController = {
	open: () => undefined,
};

export const setupPostDialog = (): PostDialogController => {
	const dialog = document.querySelector<HTMLDialogElement>("[data-post-dialog]");
	const panel = dialog?.querySelector<HTMLElement>("[data-post-dialog-panel]");
	const content = dialog?.querySelector<HTMLElement>("[data-post-dialog-content]");
	const closeButton = dialog?.querySelector<HTMLButtonElement>(
		"[data-post-dialog-close]",
	);

	if (!dialog || !panel || !content || !closeButton) return inactiveController;

	let opener: HTMLButtonElement | null = null;
	let backdropPointerStarted = false;
	let lockedScrollY = 0;
	let previousBodyPosition = "";
	let previousBodyTop = "";
	let previousBodyWidth = "";
	let isScrollLocked = false;

	const lockScroll = () => {
		if (isScrollLocked) return;
		lockedScrollY = window.scrollY;
		previousBodyPosition = document.body.style.position;
		previousBodyTop = document.body.style.top;
		previousBodyWidth = document.body.style.width;
		isScrollLocked = true;
		document.body.style.position = "fixed";
		document.body.style.top = `-${lockedScrollY}px`;
		document.body.style.width = "100%";
		document.body.classList.add("post-dialog-open");
	};

	const unlockScroll = () => {
		if (!isScrollLocked) {
			document.body.classList.remove("post-dialog-open");
			return;
		}
		isScrollLocked = false;
		document.body.style.position = previousBodyPosition;
		document.body.style.top = previousBodyTop;
		document.body.style.width = previousBodyWidth;
		document.body.classList.remove("post-dialog-open");
		window.scrollTo(0, lockedScrollY);
	};

	closeButton.addEventListener("click", () => dialog.close());

	dialog.addEventListener("pointerdown", (event) => {
		backdropPointerStarted = event.target === dialog;
	});

	dialog.addEventListener("click", (event) => {
		if (backdropPointerStarted && event.target === dialog) dialog.close();
		backdropPointerStarted = false;
	});

	dialog.addEventListener("close", () => {
		content
			.querySelectorAll<HTMLMediaElement>("audio, video")
			.forEach((media) => media.pause());
		content
			.querySelectorAll<HTMLIFrameElement>("iframe")
			.forEach((frame) => frame.removeAttribute("src"));
		content.replaceChildren();
		dialog.removeAttribute("aria-labelledby");
		dialog.removeAttribute("aria-describedby");
		dialog.setAttribute("aria-label", "Expanded post");
		unlockScroll();
		if (opener?.isConnected) opener.focus({ preventScroll: true });
		opener = null;
	});

	dialog.addEventListener("cancel", () => {
		queueMicrotask(() => {
			if (!dialog.open) unlockScroll();
		});
	});

	window.addEventListener("pagehide", () => {
		if (dialog.open) dialog.close();
		unlockScroll();
	});

	window.addEventListener("pageshow", () => {
		if (!dialog.open) unlockScroll();
	});

	return {
		open: (post, trigger, labelledBy, describedBy) => {
			if (dialog.open) return;
			opener = trigger;
			content.replaceChildren(post);
			dialog.removeAttribute("aria-label");
			dialog.setAttribute("aria-labelledby", labelledBy);
			if (describedBy) dialog.setAttribute("aria-describedby", describedBy);
			else dialog.removeAttribute("aria-describedby");
			try {
				dialog.showModal();
				lockScroll();
				closeButton.focus({ preventScroll: true });
			} catch (error) {
				if (dialog.open) dialog.close();
				unlockScroll();
				content.replaceChildren();
				opener = null;
				console.error("Could not open the post dialog.", error);
			}
		},
	};
};
