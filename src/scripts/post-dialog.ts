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

	const lockScroll = () => {
		lockedScrollY = window.scrollY;
		previousBodyPosition = document.body.style.position;
		previousBodyTop = document.body.style.top;
		previousBodyWidth = document.body.style.width;
		document.body.style.position = "fixed";
		document.body.style.top = `-${lockedScrollY}px`;
		document.body.style.width = "100%";
		document.body.classList.add("post-dialog-open");
	};

	const unlockScroll = () => {
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

	return {
		open: (post, trigger, labelledBy, describedBy) => {
			if (dialog.open) dialog.close();
			opener = trigger;
			content.replaceChildren(post);
			dialog.removeAttribute("aria-label");
			dialog.setAttribute("aria-labelledby", labelledBy);
			if (describedBy) dialog.setAttribute("aria-describedby", describedBy);
			else dialog.removeAttribute("aria-describedby");
			lockScroll();
			dialog.showModal();
			closeButton.focus({ preventScroll: true });
		},
	};
};
