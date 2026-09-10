export const DEFAULT_SITE_LOCATION = Object.freeze({
	city: "Austin",
	region: "Texas",
	regionAbbreviation: "TX",
});

const normalizeField = (value, maximumLength, required = false) => {
	if (typeof value !== "string") return required ? null : "";
	const normalized = value.trim().replace(/\s+/g, " ");
	if ((required && !normalized) || normalized.length > maximumLength) return null;
	if (/[\u0000-\u001f\u007f]/.test(normalized)) return null;
	return normalized;
};

export const normalizeSiteLocation = (value) => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const city = normalizeField(value.city, 80, true);
	const region = normalizeField(value.region, 80);
	const regionAbbreviation = normalizeField(value.regionAbbreviation, 12);
	if (city === null || region === null || regionAbbreviation === null) return null;
	return { city, region, regionAbbreviation };
};

export const formatSiteLocation = (value) => {
	const location = normalizeSiteLocation(value) || DEFAULT_SITE_LOCATION;
	const long = [location.city, location.region].filter(Boolean).join(", ");
	const shortRegion = location.regionAbbreviation || location.region;
	const short = [location.city, shortRegion].filter(Boolean).join(", ");
	return { ...location, long, short };
};
