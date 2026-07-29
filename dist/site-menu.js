const menuControls = document.querySelectorAll(".menu-control");

for (const menuControl of menuControls) {
	if (!(menuControl instanceof HTMLElement) || menuControl.dataset.menuReady === "true") {
		continue;
	}

	const menuToggle = menuControl.querySelector(".menu-toggle");
	if (!(menuToggle instanceof HTMLButtonElement)) continue;
	menuControl.dataset.menuReady = "true";

	const setMenuOpen = (isOpen) => {
		menuControl.classList.toggle("is-open", isOpen);
		menuToggle.setAttribute("aria-expanded", String(isOpen));
		menuToggle.setAttribute(
			"aria-label",
			isOpen ? "Close site menu" : "Open site menu",
		);
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
		if (event.key !== "Escape") return;
		setMenuOpen(false);
		menuToggle.focus();
	});
}
