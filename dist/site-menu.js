const menuControls = document.querySelectorAll(".menu-control");

for (const menuControl of menuControls) {
	if (!(menuControl instanceof HTMLElement) || menuControl.dataset.menuReady === "true") {
		continue;
	}

	const menuToggle = menuControl.querySelector(".menu-toggle");
	const siteMenu = menuControl.querySelector(".site-menu");
	if (
		!(menuToggle instanceof HTMLButtonElement) ||
		!(siteMenu instanceof HTMLElement)
	) {
		continue;
	}
	menuControl.dataset.menuReady = "true";

	const setMenuOpen = (isOpen) => {
		const wasOpen = menuControl.classList.contains("is-open");
		menuControl.classList.toggle("is-open", isOpen);
		siteMenu.inert = !isOpen;
		siteMenu.setAttribute("aria-hidden", String(!isOpen));
		menuToggle.setAttribute("aria-expanded", String(isOpen));
		menuToggle.setAttribute(
			"aria-label",
			isOpen ? "Close site menu" : "Open site menu",
		);

		if (isOpen && !wasOpen) {
			window.dispatchEvent(new CustomEvent("site-menu:opened"));
		}
	};

	menuToggle.addEventListener("click", () => {
		setMenuOpen(!menuControl.classList.contains("is-open"));
	});

	document.addEventListener("click", (event) => {
		if (!(event.target instanceof Node) || menuControl.contains(event.target)) {
			return;
		}
		setMenuOpen(false);
	});

	document.addEventListener("keydown", (event) => {
		if (
			event.key !== "Escape" ||
			!menuControl.classList.contains("is-open")
		) {
			return;
		}
		setMenuOpen(false);
		menuToggle.focus();
	});

	window.addEventListener("site-search:opened", () => {
		setMenuOpen(false);
	});
}
