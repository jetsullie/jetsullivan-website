import { createArrow } from "./arrow";
	const searchBar = document.querySelector<HTMLFormElement>(".search-bar");
	const searchToggle =
		document.querySelector<HTMLButtonElement>(".search-toggle");
	const searchClose =
		document.querySelector<HTMLButtonElement>(".search-close");
	const searchInput =
		document.querySelector<HTMLInputElement>(".search-input");
	const searchSuggestions = document.querySelector<HTMLElement>(
		"#site-search-suggestions",
	);
	const searchStatus =
		document.querySelector<HTMLElement>("[data-search-status]");

	if (
		searchBar &&
		searchToggle &&
		searchClose &&
		searchInput &&
		searchSuggestions &&
		searchStatus
	) {
		const compactSearchLayout = window.matchMedia("(max-width: 520px)");
		const updateSearchPlaceholder = () => {
			searchInput.placeholder = compactSearchLayout.matches
				? "Search"
				: "Where do you want to go?";
		};

		compactSearchLayout.addEventListener("change", updateSearchPlaceholder);
		updateSearchPlaceholder();

		type SearchDestination = {
			title: string;
			href: string;
			description: string;
			keywords: string[];
		};

		const siteDestinations: SearchDestination[] = [
			{
				title: "Home",
				href: "/",
				description: "Return to Jet Sullivan's homepage.",
				keywords: ["landing", "start", "jet sullivan"],
			},
			{
				title: "About",
				href: "/about/",
				description: "Learn more about Jet.",
				keywords: ["about me", "biography", "bio", "who is jet"],
			},
			{
				title: "Contact",
				href: "/contact/",
				description: "Get in touch with Jet.",
				keywords: ["email", "message", "booking", "hire"],
			},
			{
				title: "News and Media",
				href: "/media/",
				description: "Browse Jet's latest news and media.",
				keywords: ["news", "media", "updates", "articles"],
			},
			{
				title: "Featured",
				href: "/media/featured/",
				description: "See highlighted stories and work.",
				keywords: ["highlights", "top stories", "spotlight"],
			},
			{
				title: "Interviews",
				href: "/media/interviews/",
				description: "Watch and read Jet's interviews.",
				keywords: ["interview", "questions", "conversation", "podcast"],
			},
			{
				title: "Behind the Scenes",
				href: "/media/behind-the-scenes/",
				description: "Go behind the scenes of Jet's work.",
				keywords: ["bts", "on set", "process", "production"],
			},
			{
				title: "Press",
				href: "/media/press/",
				description: "Read press coverage and announcements.",
				keywords: ["coverage", "article", "publication", "release"],
			},
			{
				title: "Socials",
				href: "/socials/",
				description: "Find Jet across social platforms.",
				keywords: ["social media", "instagram", "youtube", "tiktok"],
			},
			{
				title: "Acting",
				href: "/acting/",
				description: "Explore Jet's acting work.",
				keywords: ["actor", "performing", "performance", "roles"],
			},
			{
				title: "Film",
				href: "/film/",
				description: "Explore Jet's filmmaking work.",
				keywords: ["filmmaker", "movie", "cinema", "director"],
			},
			{
				title: "Film Credits",
				href: "/film/credits/",
				description: "Browse Jet's production positions and film credits.",
				keywords: [
					"credits",
					"filmography",
					"crew",
					"positions",
					"production assistant",
					"sound mixer",
				],
			},
			{
				title: "Video",
				href: "/video/",
				description: "Explore Jet's videography work.",
				keywords: ["videographer", "camera", "content", "production"],
			},
			{
				title: "Gear",
				href: "/gear/",
				description: "Browse cameras, audio, lighting, and production kits.",
				keywords: ["gear", "equipment", "kit", "tools"],
			},
			{
				title: "Brainstorm",
				href: "/brainstorm/",
				description: "Build a living map of connected ideas.",
				keywords: ["ideas", "thoughts", "mind map", "notes", "creative"],
			},
			{
				title: "Brand Center",
				href: "/brand-center/",
				description: "Explore Jet Sullivan's visual identity guide.",
				keywords: ["brand", "branding", "identity", "colors", "assets", "style guide", "design guide", "brand centre", "logo", "typography", "palette"],
			},
		];

		let closeRippleTimer: number | undefined;
		let focusTimer: number | undefined;
		let suggestionRevealTimer: number | undefined;
		let searchResizeTimer: number | undefined;
		let visibleResults: SearchDestination[] = [];
		let activeResultIndex = -1;
		let hasRenderedSuggestions = false;
		let suggestionsReady = false;
		let renderedSuggestionLimit = 0;
		const reducedSearchMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);

		const normalizeSearchText = (value: string) =>
			value
				.toLocaleLowerCase()
				.normalize("NFKD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^a-z0-9]+/g, " ")
				.trim();

		const normalizePath = (path: string) => {
			const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
			return withLeadingSlash === "/"
				? "/"
				: `${withLeadingSlash.replace(/\/+$/, "")}/`;
		};

		const currentPath = normalizePath(window.location.pathname);
		const publicDestinations = siteDestinations.filter(
			(destination) => normalizePath(destination.href) !== currentPath,
		);

		const editDistance = (left: string, right: string) => {
			const previous = Array.from(
				{ length: right.length + 1 },
				(_, index) => index,
			);

			for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
				let diagonal = previous[0];
				previous[0] = leftIndex;

				for (
					let rightIndex = 1;
					rightIndex <= right.length;
					rightIndex += 1
				) {
					const above = previous[rightIndex];
					previous[rightIndex] = Math.min(
						previous[rightIndex] + 1,
						previous[rightIndex - 1] + 1,
						diagonal +
							(left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
					);
					diagonal = above;
				}
			}

			return previous[right.length];
		};

		const scoreDestination = (
			destination: SearchDestination,
			query: string,
		) => {
			if (!query) return 1;

			const title = normalizeSearchText(destination.title);
			const terms = [title, ...destination.keywords.map(normalizeSearchText)];
			const words = terms.flatMap((term) => term.split(" "));
			let score = 0;

			if (title === query) score += 1000;
			else if (title.startsWith(query)) score += 700;
			else if (title.includes(query)) score += 520;

			if (terms.some((term) => term === query)) score += 430;
			else if (terms.some((term) => term.startsWith(query))) score += 300;
			else if (terms.some((term) => term.includes(query))) score += 220;

			const queryWords = query.split(" ");
			for (const queryWord of queryWords) {
				let wordScore = 0;

				for (const word of words) {
					if (word === queryWord) wordScore = Math.max(wordScore, 130);
					else if (word.startsWith(queryWord)) {
						wordScore = Math.max(wordScore, 100);
					} else if (word.includes(queryWord)) {
						wordScore = Math.max(wordScore, 70);
					} else if (
						queryWord.length >= 4 &&
						Math.abs(word.length - queryWord.length) <= 2 &&
						editDistance(word, queryWord) <=
							(queryWord.length >= 6 ? 2 : 1)
					) {
						wordScore = Math.max(wordScore, 48);
					}
				}

				if (wordScore === 0) return -1;
				score += wordScore;
			}

			return score;
		};

		const setActiveResult = (nextIndex: number) => {
			const resultElements = Array.from(
				searchSuggestions.querySelectorAll<HTMLElement>(".search-suggestion"),
			);

			if (resultElements.length === 0) {
				activeResultIndex = -1;
				searchInput.removeAttribute("aria-activedescendant");
				return;
			}

			activeResultIndex =
				(nextIndex + resultElements.length) % resultElements.length;

			resultElements.forEach((result, index) => {
				const isActive = index === activeResultIndex;
				result.classList.toggle("is-active", isActive);
				result.setAttribute("aria-selected", String(isActive));

				if (isActive) {
					searchInput.setAttribute("aria-activedescendant", result.id);
					result.scrollIntoView({ block: "nearest" });
				}
			});
		};

		const hideSuggestions = () => {
			searchSuggestions.hidden = true;
			searchSuggestions.replaceChildren();
			searchInput.setAttribute("aria-expanded", "false");
			searchInput.removeAttribute("aria-activedescendant");
			visibleResults = [];
			activeResultIndex = -1;
			hasRenderedSuggestions = false;
			renderedSuggestionLimit = 0;
		};

		const getMaximumSuggestionCount = () => {
			const viewportHeight =
				window.visualViewport?.height ?? window.innerHeight;
			return Math.max(
				2,
				Math.min(6, Math.floor((viewportHeight - 130) / 60)),
			);
		};

		const renderSuggestions = () => {
			if (!searchBar.classList.contains("is-open")) {
				hideSuggestions();
				return;
			}

			if (!suggestionsReady) return;

			const query = normalizeSearchText(searchInput.value);
			const useOpeningCascade = !hasRenderedSuggestions;
			const suggestionDuration = useOpeningCascade ? 330 : 210;
			const suggestionStartDelay = useOpeningCascade ? 55 : 12;
			const suggestionDelayStep = useOpeningCascade ? 55 : 18;
			const maximumSuggestionCount = getMaximumSuggestionCount();
			renderedSuggestionLimit = maximumSuggestionCount;
			const rankedDestinations = publicDestinations
				.map((destination, order) => ({
					destination,
					order,
					score: scoreDestination(destination, query),
				}))
				.filter((result) => result.score >= 0)
				.sort((left, right) => right.score - left.score || left.order - right.order)
				.slice(0, maximumSuggestionCount);

			visibleResults = rankedDestinations.map((result) => result.destination);
			activeResultIndex = -1;
			searchInput.removeAttribute("aria-activedescendant");
			searchSuggestions.replaceChildren();

			if (visibleResults.length === 0) {
				const emptyMessage = document.createElement("p");
				emptyMessage.className = "search-empty";
				emptyMessage.style.setProperty(
					"--suggestion-duration",
					`${suggestionDuration}ms`,
				);
				emptyMessage.style.setProperty(
					"--suggestion-delay",
					`${suggestionStartDelay}ms`,
				);
				emptyMessage.textContent = "No matching page yet. Try another search.";
				searchSuggestions.append(emptyMessage);
				searchStatus.textContent = "No matching pages.";
			} else {
				const resultFragment = document.createDocumentFragment();

				visibleResults.forEach((destination, index) => {
					const result = document.createElement("a");
					const copy = document.createElement("span");
					const title = document.createElement("strong");
					const description = document.createElement("small");
					const arrow = document.createElement("span");
					const arrowIcon = createArrow("right");

					result.id = `site-search-result-${index}`;
					result.className = "search-suggestion";
					result.href = destination.href;
					result.setAttribute("role", "option");
					result.setAttribute("aria-selected", "false");
					result.tabIndex = -1;
					result.style.setProperty(
						"--suggestion-delay",
						`${suggestionStartDelay + index * suggestionDelayStep}ms`,
					);
					result.style.setProperty(
						"--suggestion-duration",
						`${suggestionDuration}ms`,
					);
					copy.className = "search-suggestion-copy";
					title.textContent = destination.title;
					description.textContent = destination.description;
					arrow.className = "search-suggestion-arrow";
					arrow.setAttribute("aria-hidden", "true");
					arrowIcon.setAttribute("focusable", "false");
					arrow.append(arrowIcon);

					copy.append(title, description);
					result.append(copy, arrow);
					result.addEventListener("pointerenter", () => setActiveResult(index));
					resultFragment.append(result);
				});

				searchSuggestions.append(resultFragment);
				searchStatus.textContent = `${visibleResults.length} page${visibleResults.length === 1 ? "" : "s"} suggested.`;
			}

			searchSuggestions.hidden = false;
			searchInput.setAttribute("aria-expanded", "true");
			hasRenderedSuggestions = true;
		};

		const setSearchOpen = (isOpen: boolean) => {
			const wasOpen = searchBar.classList.contains("is-open");
			window.clearTimeout(closeRippleTimer);
			window.clearTimeout(focusTimer);
			window.clearTimeout(suggestionRevealTimer);
			window.clearTimeout(searchResizeTimer);

			if (isOpen) {
				suggestionsReady = false;
				searchBar.classList.remove("is-closing", "suppress-hover");
				searchBar.classList.add("is-open");
				window.dispatchEvent(new CustomEvent("site-search:opened"));
				suggestionRevealTimer = window.setTimeout(() => {
					if (!searchBar.classList.contains("is-open")) return;
					suggestionsReady = true;
					renderSuggestions();
				}, reducedSearchMotion.matches ? 0 : 420);
			} else {
				suggestionsReady = false;
				hideSuggestions();
				searchBar.classList.remove("is-open", "is-closing");
				if (wasOpen) {
					window.dispatchEvent(new CustomEvent("site-search:closed"));
				}

				if (wasOpen) {
					void searchBar.offsetWidth;
					searchBar.classList.add("is-closing", "suppress-hover");
					closeRippleTimer = window.setTimeout(() => {
						searchBar.classList.remove("is-closing");
						if (!searchBar.matches(":hover")) {
							searchBar.classList.remove("suppress-hover");
						}
					}, 410);
				}
			}

			searchToggle.setAttribute("aria-expanded", String(isOpen));
			searchInput.tabIndex = isOpen ? 0 : -1;
			searchClose.tabIndex = isOpen ? 0 : -1;
			searchInput.setAttribute("aria-hidden", String(!isOpen));
			searchClose.setAttribute("aria-hidden", String(!isOpen));
			searchToggle.setAttribute(
				"aria-label",
				isOpen ? "Close site search" : "Open site search",
			);

			if (isOpen) {
				focusTimer = window.setTimeout(
					() => searchInput.focus(),
					reducedSearchMotion.matches ? 0 : 180,
				);
			}
		};

		searchToggle.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			setSearchOpen(!searchBar.classList.contains("is-open"));
		});

		searchClose.addEventListener("click", () => {
			setSearchOpen(false);
			searchToggle.focus();
		});

		searchBar.addEventListener("submit", (event) => {
			event.preventDefault();
			const query = normalizeSearchText(searchInput.value);

			if (query === "brand center" || query === "brandcenter") {
				window.location.assign("/brand-center/");
				return;
			}

			if (query === "admin") {
				window.location.assign("/login/");
				return;
			}

			const selectedDestination =
				visibleResults[activeResultIndex] ?? visibleResults[0];

			if (selectedDestination && (query || activeResultIndex >= 0)) {
				window.location.assign(selectedDestination.href);
				return;
			}

			searchStatus.textContent = query
				? "No matching page. Try another search."
				: "Type a page or topic to search.";
		});

		searchInput.addEventListener("input", renderSuggestions);
		searchInput.addEventListener("focus", renderSuggestions);

		searchBar.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				setSearchOpen(false);
				searchToggle.focus();
				return;
			}

			if (event.target !== searchInput) return;

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				if (visibleResults.length === 0) return;
				event.preventDefault();
				setActiveResult(
					event.key === "ArrowDown"
						? activeResultIndex + 1
						: activeResultIndex < 0
							? visibleResults.length - 1
							: activeResultIndex - 1,
				);
				return;
			}

			if (event.key === "Home" && visibleResults.length > 0) {
				event.preventDefault();
				setActiveResult(0);
				return;
			}

			if (event.key === "End" && visibleResults.length > 0) {
				event.preventDefault();
				setActiveResult(visibleResults.length - 1);
				return;
			}
		});

		document.addEventListener("pointerdown", (event) => {
			if (
				searchBar.classList.contains("is-open") &&
				event.target instanceof Node &&
				!searchBar.contains(event.target)
			) {
				setSearchOpen(false);
			}
		});

		window.addEventListener("site-menu:opened", () => {
			setSearchOpen(false);
		});

		const updateSuggestionsForViewport = () => {
			window.clearTimeout(searchResizeTimer);
			searchResizeTimer = window.setTimeout(() => {
				if (
					searchBar.classList.contains("is-open") &&
					suggestionsReady &&
					getMaximumSuggestionCount() !== renderedSuggestionLimit
				) {
					renderSuggestions();
				}
			}, 120);
		};

		window.addEventListener("resize", updateSuggestionsForViewport);
		window.visualViewport?.addEventListener(
			"resize",
			updateSuggestionsForViewport,
		);

		searchBar.addEventListener("pointerleave", () => {
			searchBar.classList.remove("suppress-hover");
		});
	}

	const portraitTrigger =
		document.querySelector<HTMLImageElement>("[data-portrait-trigger]");
	const portraitEmojiLayer =
		document.querySelector<HTMLElement>(".portrait-emoji-layer");

	if (portraitTrigger && portraitEmojiLayer) {
		const commonPortraitEmojis = ["📸", "🎥", "📷"];
		const rarePortraitEmojis = ["🤘", "🎂", "😆", "❤️"];
		const reducedPortraitMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		const activePortraitEmojis: HTMLElement[] = [];
		const randomBetween = (minimum: number, maximum: number) =>
			minimum + Math.random() * (maximum - minimum);

		const removePortraitEmoji = (emoji: HTMLElement) => {
			const emojiIndex = activePortraitEmojis.indexOf(emoji);
			if (emojiIndex >= 0) activePortraitEmojis.splice(emojiIndex, 1);
			emoji.remove();
		};

		const emitPortraitBurst = (clientX?: number, clientY?: number) => {
			const portraitBounds = portraitTrigger.getBoundingClientRect();
			const layerBounds = portraitEmojiLayer.getBoundingClientRect();
			const originX =
				(clientX ?? portraitBounds.left + portraitBounds.width / 2) -
				layerBounds.left;
			const originY =
				(clientY ?? portraitBounds.top + portraitBounds.height / 2) -
				layerBounds.top;
			const isReducedMotion = reducedPortraitMotion.matches;
			const burstSize = 1;

			for (let index = 0; index < burstSize; index += 1) {
				while (activePortraitEmojis.length >= 72) {
					const oldestEmoji = activePortraitEmojis.shift();
					oldestEmoji?.remove();
				}

				const emoji = document.createElement("span");
				const emojiPool =
					Math.random() < 0.01
						? rarePortraitEmojis
						: commonPortraitEmojis;
				const fontSize =
					Math.max(
						26,
						Math.min(
							56,
							Math.max(
								window.innerWidth * 0.035,
								portraitBounds.width * 0.16,
							),
						),
					) *
					randomBetween(0.82, 1.18);
				const startX =
					originX +
					randomBetween(
						-Math.min(20, portraitBounds.width * 0.05),
						Math.min(20, portraitBounds.width * 0.05),
					);
				const startY =
					originY +
					randomBetween(
						-Math.min(16, portraitBounds.height * 0.025),
						Math.min(16, portraitBounds.height * 0.025),
					);

				emoji.className = "portrait-emoji";
				emoji.textContent =
					emojiPool[Math.floor(Math.random() * emojiPool.length)];
				emoji.style.left = `${startX}px`;
				emoji.style.top = `${startY}px`;
				emoji.style.fontSize = `${fontSize}px`;
				portraitEmojiLayer.append(emoji);
				activePortraitEmojis.push(emoji);

				if (isReducedMotion) {
					const reducedAnimation = emoji.animate(
						[
							{
								opacity: 0,
								transform:
									"translate(-50%, -50%) scale(0.72)",
							},
							{
								opacity: 1,
								transform:
									"translate(-50%, -50%) scale(1)",
								offset: 0.35,
							},
							{
								opacity: 0,
								transform:
									"translate(-50%, -50%) scale(1)",
							},
						],
						{ duration: 620, easing: "ease-out" },
					);
					reducedAnimation.addEventListener(
						"finish",
						() => removePortraitEmoji(emoji),
						{ once: true },
					);
					window.setTimeout(
						() => removePortraitEmoji(emoji),
						750,
					);
					continue;
				}

				const launchAngle = randomBetween(
					-Math.PI + 0.24,
					-0.24,
				);
				const launchSpeed = randomBetween(430, 720);
				const horizontalVelocity =
					Math.cos(launchAngle) * launchSpeed;
				const verticalVelocity =
					Math.sin(launchAngle) * launchSpeed;
				const horizontalDrift = randomBetween(-70, 70);
				const gravity = randomBetween(1180, 1540);
				const targetDrop = Math.max(
					180,
					layerBounds.height - startY + fontSize * 2,
				);
				const naturalFlightTime =
					(-verticalVelocity +
						Math.sqrt(
							verticalVelocity ** 2 +
								2 * gravity * targetDrop,
						)) /
					gravity;
				const flightTime = Math.max(
					1.6,
					Math.min(3.2, naturalFlightTime),
				);
				const spinVelocity = randomBetween(-520, 520);
				const frameCount = 18;
				const keyframes: Keyframe[] = [];

				for (let frame = 0; frame <= frameCount; frame += 1) {
					const progress = frame / frameCount;
					const elapsed = progress * flightTime;
					const horizontalPosition =
						horizontalVelocity * elapsed +
						0.5 * horizontalDrift * elapsed ** 2;
					const verticalPosition =
						verticalVelocity * elapsed +
						0.5 * gravity * elapsed ** 2;
					const scale =
						progress < 0.12
							? 0.38 + (progress / 0.12) * 0.77
							: 1.15 - ((progress - 0.12) / 0.88) * 0.18;

					keyframes.push({
						offset: progress,
						opacity: progress === 0 ? 0 : 1,
						transform: `translate(calc(-50% + ${horizontalPosition}px), calc(-50% + ${verticalPosition}px)) rotate(${spinVelocity * elapsed}deg) scale(${scale})`,
					});
				}

				const duration = flightTime * 1000;
				const animation = emoji.animate(keyframes, {
					duration,
					easing: "linear",
					fill: "forwards",
				});
				animation.addEventListener(
					"finish",
					() => removePortraitEmoji(emoji),
					{ once: true },
				);
				window.setTimeout(
					() => removePortraitEmoji(emoji),
					duration + 180,
				);
			}
		};

		portraitTrigger.addEventListener("click", (event) => {
			const hasPointerCoordinates = event.detail > 0;
			emitPortraitBurst(
				hasPointerCoordinates ? event.clientX : undefined,
				hasPointerCoordinates ? event.clientY : undefined,
			);
		});

		portraitTrigger.addEventListener("keydown", (event) => {
			if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
				return;
			}

			event.preventDefault();
			emitPortraitBurst();
		});
	}

const observer = new IntersectionObserver(entries => { for (const entry of entries) { if (!entry.isIntersecting) continue; entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }, {threshold: .5});
document.querySelectorAll("[data-home-shimmer]").forEach(el => observer.observe(el));

	const selectionBox = document.querySelector<HTMLElement>(".location-box");
	const dragCursor = document.querySelector<HTMLElement>(".selection-cursor");
	const locationRoles = document.querySelector<HTMLElement>(".location-roles");

	if (selectionBox && dragCursor) {
		let startPointerX = 0;
		let startPointerY = 0;
		let originalWidth = 0;
		let originalHeight = 0;
		let returnTimer: number | undefined;
		let isDragging = false;
		let revealLocationRoles = false;

		const updateLocationRolesReveal = () => {
			if (!locationRoles || !revealLocationRoles) {
				locationRoles?.style.setProperty(
					"clip-path",
					"inset(0 100% 100% 0)",
				);
				return;
			}

			const boxBounds = selectionBox.getBoundingClientRect();
			const rolesBounds = locationRoles.getBoundingClientRect();
			const intersectionTop = Math.max(
				boxBounds.top,
				rolesBounds.top,
			);
			const intersectionRight = Math.min(
				boxBounds.right,
				rolesBounds.right,
			);
			const intersectionBottom = Math.min(
				boxBounds.bottom,
				rolesBounds.bottom,
			);
			const intersectionLeft = Math.max(
				boxBounds.left,
				rolesBounds.left,
			);

			if (
				intersectionRight <= intersectionLeft ||
				intersectionBottom <= intersectionTop
			) {
				locationRoles.style.clipPath = "inset(0 100% 100% 0)";
				return;
			}

			locationRoles.style.clipPath = `inset(${intersectionTop - rolesBounds.top}px ${rolesBounds.right - intersectionRight}px ${rolesBounds.bottom - intersectionBottom}px ${intersectionLeft - rolesBounds.left}px)`;
		};

		const selectionRevealObserver = new ResizeObserver(
			updateLocationRolesReveal,
		);
		selectionRevealObserver.observe(selectionBox);
		window.addEventListener("resize", updateLocationRolesReveal);
		document.fonts.ready.then(updateLocationRolesReveal);
		updateLocationRolesReveal();

		dragCursor.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
            if (event.detail === 0) {
                revealLocationRoles = dragCursor.getAttribute('aria-expanded') !== 'true';
                dragCursor.setAttribute('aria-expanded', String(revealLocationRoles));
                selectionBox.style.width = revealLocationRoles ? `${locationRoles!.offsetWidth + 38}px` : '';
                selectionBox.style.height = revealLocationRoles ? '125px' : '';
                updateLocationRolesReveal();
            }
		});

		dragCursor.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			window.clearTimeout(returnTimer);

			const boxBounds = selectionBox.getBoundingClientRect();

			startPointerX = event.clientX;
			startPointerY = event.clientY;
			originalWidth = boxBounds.width;
			originalHeight = boxBounds.height;

			selectionBox.style.transition = "none";
			selectionBox.style.width = `${originalWidth}px`;
			selectionBox.style.height = `${originalHeight}px`;

			isDragging = true;
            dragCursor.setAttribute('aria-expanded', 'true');
			dragCursor.setPointerCapture(event.pointerId);
		});

		dragCursor.addEventListener("pointermove", (event) => {
			if (!dragCursor.hasPointerCapture(event.pointerId)) return;

			const nextWidth = Math.max(
				24,
				originalWidth + event.clientX - startPointerX,
			);
			const nextHeight = Math.max(
				24,
				originalHeight + event.clientY - startPointerY,
			);

			selectionBox.style.width = `${nextWidth}px`;
			selectionBox.style.height = `${nextHeight}px`;
			revealLocationRoles =
				nextWidth > originalWidth + 1 ||
				nextHeight > originalHeight + 1;
			window.requestAnimationFrame(updateLocationRolesReveal);
		});

		const returnSelection = (event: PointerEvent) => {
			if (!isDragging) return;

			isDragging = false;
            dragCursor.setAttribute('aria-expanded', 'false');
			if (dragCursor.hasPointerCapture(event.pointerId)) {
				dragCursor.releasePointerCapture(event.pointerId);
			}
			selectionBox.style.transition =
				"width 700ms cubic-bezier(0.22, 1, 0.36, 1), height 700ms cubic-bezier(0.22, 1, 0.36, 1)";
			selectionBox.style.width = `${originalWidth}px`;
			selectionBox.style.height = `${originalHeight}px`;

			returnTimer = window.setTimeout(() => {
				selectionBox.style.removeProperty("transition");
				selectionBox.style.removeProperty("width");
				selectionBox.style.removeProperty("height");
				revealLocationRoles = false;
				updateLocationRolesReveal();
			}, 720);
		};

		dragCursor.addEventListener("pointerup", returnSelection);
		dragCursor.addEventListener("pointercancel", returnSelection);
	}


// Let the light follow the pointer, as on the shared site's gear controls.
document.querySelectorAll<HTMLElement>('.glow-button').forEach(button => {
 button.addEventListener('pointermove', event => {
  const rect = button.getBoundingClientRect();
  button.style.setProperty('--glass-light-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
  button.style.setProperty('--glass-light-y', `${(event.clientY - rect.top) / rect.height * 100}%`);
 });
});

// Match the alternate title color to the hero's diagonal at every viewport size.
const heroCanvas = document.querySelector<HTMLElement>('.canvas');
const heroTitle = document.querySelector<HTMLElement>('.hero-name');
const homeMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const alignTitleDivide = () => {
  if (!heroCanvas || !heroTitle) return;
  const canvas = heroCanvas.getBoundingClientRect();
  const start = window.matchMedia('(max-width:650px)').matches ? .66 : .61;
  const slope = .13 * canvas.width / canvas.height;
  const angle = Math.atan(slope);
  // Color the actual glyphs instead of clipping a duplicate moving title.
  const paints = Array.from(heroTitle.querySelectorAll<HTMLElement>('.hero-letter'), letter => {
   const rect = letter.getBoundingClientRect();
   const edge = canvas.left + canvas.width * start - slope * (rect.top + rect.height / 2 - canvas.top);
   const length = rect.width * Math.cos(angle) + rect.height * Math.sin(angle);
   return { letter, stop: length / 2 + (edge - rect.left - rect.width / 2) * Math.cos(angle) };
  });
  for (const { letter, stop } of paints) {
   letter.style.setProperty('--letter-angle', `${90 + angle * 180 / Math.PI}deg`);
   letter.style.setProperty('--letter-divide', `${stop}px`);
  }
 };
if (heroCanvas && heroTitle) {
 new ResizeObserver(alignTitleDivide).observe(heroCanvas);
 window.addEventListener('resize', alignTitleDivide);
 document.fonts.ready.then(alignTitleDivide);
 alignTitleDivide();
}

// Give each title letter the same anchored collision feel as a Brainstorm bubble.
if (heroTitle) {
 const baseLetters = Array.from(heroTitle.querySelectorAll<HTMLElement>('.hero-name-base .hero-letter'));
 const letterLayers = baseLetters.map(letter => Array.from(heroTitle.querySelectorAll<HTMLElement>(`.hero-letter[data-letter-index="${letter.dataset.letterIndex}"]`)));
 const states = baseLetters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, rotation: 0, light: 0 }));
 let pointerX = 0;
 let pointerY = 0;
 let pointerActive = false;
 let titleFrame = 0;
 let previousTitleTime = 0;

 const renderTitlePhysics = (time: number) => {
  const step = Math.min(2, Math.max(.25, (time - previousTitleTime) / 16.67));
  previousTitleTime = time;
  let moving = false;
  const rectangles = baseLetters.map(letter => letter.getBoundingClientRect());
  states.forEach((state, index) => {
   const letter = baseLetters[index];
   const rect = rectangles[index];
   let targetLight = 0;
   if (pointerActive && letter.textContent?.trim()) {
    const centerX = rect.left + rect.width / 2 - state.x;
    const centerY = rect.top + rect.height / 2 - state.y;
    const dx = centerX + state.x - pointerX;
    const dy = centerY + state.y - pointerY;
    const distance = Math.hypot(dx, dy) || 1;
    const radius = Math.max(58, rect.height * .72);
    if (distance < radius) {
     const pressure = (radius - distance) / radius;
     state.vx += dx / distance * pressure * 1.3 * step;
     state.vy += dy / distance * pressure * 1.3 * step;
     targetLight = Math.min(1, pressure * 1.7);
    }
   }
   state.vx = (state.vx - state.x * .095 * step) * Math.pow(.79, step);
   state.vy = (state.vy - state.y * .095 * step) * Math.pow(.79, step);
   const minX = Math.max(-14, -(rect.left - state.x));
   const maxX = Math.min(14, window.innerWidth - (rect.right - state.x));
   state.x = Math.max(minX, Math.min(maxX, state.x + state.vx * step));
   state.y = Math.max(-12, Math.min(12, state.y + state.vy * step));
   state.light += (targetLight - state.light) * .2;
   for (const layer of letterLayers[index]) {
    layer.style.setProperty('--letter-x', `${state.x.toFixed(2)}px`);
    layer.style.setProperty('--letter-y', `${state.y.toFixed(2)}px`);
    layer.style.setProperty('--letter-rotate', `${state.rotation.toFixed(2)}deg`);
    layer.style.setProperty('--letter-light', state.light.toFixed(3));
   }
   moving ||= Math.abs(state.x) + Math.abs(state.y) + Math.abs(state.vx) + Math.abs(state.vy) + state.light > .08;
  });
  alignTitleDivide();
  if (moving || pointerActive) titleFrame = requestAnimationFrame(renderTitlePhysics);
  else titleFrame = 0;
 };
 const startTitlePhysics = () => { if (!titleFrame && !homeMotionPreference.matches) { previousTitleTime = performance.now(); titleFrame = requestAnimationFrame(renderTitlePhysics); } };
 heroTitle.addEventListener('pointermove', event => {
  pointerX = event.clientX;
  pointerY = event.clientY;
  pointerActive = event.pointerType === 'mouse';
  startTitlePhysics();
 });
 heroTitle.addEventListener('pointerleave', () => {
  pointerActive = false;
  startTitlePhysics();
 });
 homeMotionPreference.addEventListener('change', () => {
  cancelAnimationFrame(titleFrame);
  titleFrame = 0;
  pointerActive = false;
  states.forEach((state, index) => {
   Object.assign(state, {x:0,y:0,vx:0,vy:0,light:0});
   for (const letter of letterLayers[index]) {
    letter.style.setProperty('--letter-x', '0px');
    letter.style.setProperty('--letter-y', '0px');
    letter.style.setProperty('--letter-light', '0');
   }
  });
  alignTitleDivide();
 });
}

// Layer pointer parallax with a damped scroll offset so every section has weight.
const homeSections = Array.from(document.querySelectorAll<HTMLElement>('.canvas,.work-band,.home-section,.site-footer,.home-header'));
if (homeSections.length) {
 const states = homeSections.map(() => ({ pointerX: 0, pointerY: 0, scroll: 0, layers: [0,1,2].map(() => ({position:0,velocity:0})) }));
 let targetPointerX = 0;
 let targetPointerY = 0;
 let motionFrame = 0;
 let previousMotionTime = performance.now();
 const renderHomeMotion = (time: number) => {
  const step = Math.min(2, Math.max(.25, (time - previousMotionTime) / 16.67));
  previousMotionTime = time;
  let moving = false;
  homeSections.forEach((section, index) => {
   const state = states[index];
   const rect = section.getBoundingClientRect();
   const scrollTarget = section.matches('.home-header,.site-footer') ? 0 : Math.max(-1, Math.min(1, (window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight));
   state.pointerX += (targetPointerX - state.pointerX) * .065;
   state.pointerY += (targetPointerY - state.pointerY) * .065;
   state.scroll += (scrollTarget - state.scroll) * .055;
   section.style.setProperty('--home-scene-x', `${(state.pointerX * (window.innerWidth <= 650 ? 2 : 5)).toFixed(2)}px`);
   section.style.setProperty('--home-scene-y', `${(state.pointerY * 4).toFixed(2)}px`);
   section.style.setProperty('--home-bg-x', `${(state.pointerX * -18).toFixed(2)}px`);
   section.style.setProperty('--home-bg-y', `${(state.pointerY * -14).toFixed(2)}px`);
   section.style.setProperty('--home-far-x', `${(state.pointerX * -6).toFixed(2)}px`);
   section.style.setProperty('--home-far-y', `${(state.pointerY * -5).toFixed(2)}px`);
   section.style.setProperty('--home-deep-x', `${(state.pointerX * -12).toFixed(2)}px`);
   section.style.setProperty('--home-deep-y', `${(state.pointerY * -9).toFixed(2)}px`);
   section.style.setProperty('--home-scroll-scene', `${(state.scroll * 8).toFixed(2)}px`);
   // Larger glass pieces accelerate slowly; smaller pieces catch up sooner.
   const distances = window.innerWidth <= 650 ? [22,28,34] : [42,64,84];
   state.layers.forEach((layer, depth) => {
    const target = -scrollTarget * distances[depth];
    const stiffness = [.018,.026,.036][depth];
    const damping = [.85,.82,.79][depth];
    layer.velocity = (layer.velocity + (target - layer.position) * stiffness * step) * Math.pow(damping,step);
    layer.position += layer.velocity * step;
    const unsettled = Math.abs(target - layer.position) + Math.abs(layer.velocity) > .03;
    if (!unsettled) { layer.position = target; layer.velocity = 0; }
    section.style.setProperty(`--home-scroll-${['far','deep','near'][depth]}`, `${layer.position.toFixed(2)}px`);
    moving ||= unsettled;
   });
   moving ||= Math.abs(targetPointerX - state.pointerX) + Math.abs(targetPointerY - state.pointerY) + Math.abs(scrollTarget - state.scroll) > .002;
  });
  alignTitleDivide();
  if (moving) motionFrame = requestAnimationFrame(renderHomeMotion);
  else motionFrame = 0;
 };
 const startHomeMotion = () => { if (!motionFrame && !homeMotionPreference.matches && !document.hidden) { previousMotionTime = performance.now(); motionFrame = requestAnimationFrame(renderHomeMotion); } };
 window.addEventListener('pointermove', event => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  targetPointerX = (event.clientX / window.innerWidth - .5) * 2;
  targetPointerY = (event.clientY / window.innerHeight - .5) * 2;
  startHomeMotion();
 }, { passive: true });
 window.addEventListener('scroll', startHomeMotion, { passive: true });
 window.addEventListener('resize', startHomeMotion, { passive: true });
 homeMotionPreference.addEventListener('change', () => {
  cancelAnimationFrame(motionFrame);
  motionFrame = 0;
  if (homeMotionPreference.matches) {
   homeSections.forEach(section => {
    for (const property of Array.from(section.style)) if (property.startsWith('--home-')) section.style.removeProperty(property);
   });
   states.forEach(state => { Object.assign(state, {pointerX:0,pointerY:0,scroll:0}); state.layers.forEach(layer => Object.assign(layer,{position:0,velocity:0})); });
   alignTitleDivide();
  } else startHomeMotion();
 });
 document.documentElement.addEventListener('mouseleave', () => {
  targetPointerX = 0;
  targetPointerY = 0;
  startHomeMotion();
 });
 startHomeMotion();
}
