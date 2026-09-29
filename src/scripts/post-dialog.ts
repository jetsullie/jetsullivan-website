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
 let transition: Animation | null = null;
 let closing = false;
 let restoreOpenerFocus = true;
 let sourceCard: HTMLElement | null = null;
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
 const notifyMotion = () => window.dispatchEvent(new Event('post-dialog:change'));
 const sourceTransform = () => {
  const from = sourceCard?.getBoundingClientRect();
  const to = panel.getBoundingClientRect();
  if (!from || !to.width || !to.height) return 'translateY(12px) scale(.97)';
  return `translate(${from.left + from.width / 2 - to.left - to.width / 2}px, ${from.top + from.height / 2 - to.top - to.height / 2}px) scale(${from.width / to.width}, ${from.height / to.height})`;
 };
 const close = (event?: Event) => {
  if (!dialog.open || closing) return;
  restoreOpenerFocus = !(event instanceof MouseEvent) || event.detail === 0;
  closing = true;
  dialog.setAttribute('data-closing', '');
  const current = getComputedStyle(panel);
  const start = {transform:current.transform, opacity:current.opacity};
  transition?.cancel();
  transition = panel.animate(reduced.matches ? [{opacity:1},{opacity:0}] : [start, {transform:sourceTransform(),opacity:0}], {
   duration:reduced.matches ? 120 : 300, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards',
  });
  transition.onfinish = () => dialog.close();
 };

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
		window.scrollTo({top:lockedScrollY, behavior:'instant'});
	};

	closeButton.addEventListener("click", close);

	const isClickOutsidePanel = (event: MouseEvent | PointerEvent) => {
		if (!dialog.open) return false;
		const panelEl = dialog.querySelector<HTMLElement>("[data-post-dialog-panel]");
		if (!panelEl) return false;
		const rect = panelEl.getBoundingClientRect();
		return (
			event.clientX < rect.left ||
			event.clientX > rect.right ||
			event.clientY < rect.top ||
			event.clientY > rect.bottom
		);
	};

	window.addEventListener("pointerdown", (event) => {
		if (!dialog.open) return;
		backdropPointerStarted = isClickOutsidePanel(event);
	}, true);

	window.addEventListener("click", (event) => {
		if (!dialog.open) return;
		if (backdropPointerStarted && isClickOutsidePanel(event)) {
			event.preventDefault();
			event.stopPropagation();
			close(event);
		}
		backdropPointerStarted = false;
	}, true);

	dialog.addEventListener("close", () => {
  transition?.cancel();
  transition = null;
  closing = false;
  dialog.removeAttribute('data-closing');
  sourceCard?.classList.remove('is-dialog-source');
  sourceCard = null;
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
		if (restoreOpenerFocus && opener?.isConnected) {
			opener.focus({ preventScroll: true });
		} else {
			opener?.blur();
			const activeEl = document.activeElement;
			if (activeEl instanceof HTMLElement && activeEl.closest('.post-bubbles .entry-card')) activeEl.blur();
		}
		opener = null;
  notifyMotion();
	});

	dialog.addEventListener("cancel", event => { event.preventDefault(); close(event); });

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
   restoreOpenerFocus = true;
   sourceCard = trigger.closest<HTMLElement>(".entry-card");
			content.replaceChildren(post);
			dialog.removeAttribute("aria-label");
			dialog.setAttribute("aria-labelledby", labelledBy);
			if (describedBy) dialog.setAttribute("aria-describedby", describedBy);
			else dialog.removeAttribute("aria-describedby");
			try {
				dialog.showModal();
				lockScroll();
				closeButton.focus({ preventScroll: true });
    panel.scrollTop = 0;
    transition = panel.animate(reduced.matches ? [{opacity:0},{opacity:1}] : [
     {transform:sourceTransform(),opacity:0,borderRadius:'24px'},
     {transform:'translate(0,0) scale(1)',opacity:1,borderRadius:'24px'},
    ], {duration:reduced.matches ? 160 : 440,easing:'cubic-bezier(.22,1,.36,1)'});
    sourceCard?.classList.add('is-dialog-source');
    notifyMotion();
			} catch (error) {
				if (dialog.open) dialog.close();
				unlockScroll();
				content.replaceChildren();
				opener = null;
    sourceCard?.classList.remove('is-dialog-source');
    sourceCard = null;
    notifyMotion();
				console.error("Could not open the post dialog.", error);
			}
		},
	};
};
