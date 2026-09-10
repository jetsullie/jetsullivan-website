(() => {
	const fallback = { city: "Austin", region: "Texas", regionAbbreviation: "TX" };
	const metaTemplates = new WeakMap();

	const normalize = (value) => {
		if (!value || typeof value !== "object") return fallback;
		const clean = (field, maximumLength) =>
			typeof field === "string" ? field.trim().replace(/\s+/g, " ").slice(0, maximumLength) : "";
		const city = clean(value.city, 80);
		if (!city) return fallback;
		return {
			city,
			region: clean(value.region, 80),
			regionAbbreviation: clean(value.regionAbbreviation, 12),
		};
	};

	const format = (value) => {
		const location = normalize(value);
		const long = [location.city, location.region].filter(Boolean).join(", ");
		const shortRegion = location.regionAbbreviation || location.region;
		const short = [location.city, shortRegion].filter(Boolean).join(", ");
		return { ...location, long, short };
	};

	const applyLocation = (value) => {
		const location = format(value);
		document.documentElement.dataset.siteCity = location.city;
		document.querySelectorAll("[data-site-location]").forEach((element) => {
			const formatName = element.dataset.siteLocation;
			element.textContent = location[formatName] || location.long;
		});

		document
			.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]')
			.forEach((meta) => {
				if (!metaTemplates.has(meta)) metaTemplates.set(meta, meta.getAttribute("content") || "");
				const template = metaTemplates.get(meta);
				const replacements = {
					"Austin, Texas": location.long,
					"Austin, TX": location.short,
					"Austin-based": `${location.city}-based`,
					Austin: location.city,
				};
				meta.setAttribute("content", template.replace(
					/Austin, Texas|Austin, TX|Austin-based|Austin/g,
					(match) => replacements[match],
				));
			});

		window.dispatchEvent(new CustomEvent("jet:site-location-applied", { detail: location }));
	};

	window.addEventListener("jet:site-location-update", (event) => {
		applyLocation(event.detail?.location ?? event.detail);
	});

	fetch("/api/content/site", { headers: { Accept: "application/json" } })
		.then((response) => response.ok ? response.json() : null)
		.then((result) => {
			if (result?.content?.location) applyLocation(result.content.location);
		})
		.catch(() => {
			// Static defaults remain visible when public content storage is unavailable.
		});
})();
