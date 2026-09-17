// The site's back-button arrow, rotated without changing its proportions.
export const arrowPath = "M23 10H3M10 3L3 10L10 17";
export const arrowAngles = { left: 0, right: 180, up: 90, down: 270, northeast: 135, southeast: 225 };
export type ArrowDirection = keyof typeof arrowAngles;
export const arrowStyle = "display:inline-block;width:1em;height:1em;flex-shrink:0;vertical-align:-.15em;fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;stroke-linejoin:round";
export const createArrow = (direction: ArrowDirection = "northeast") => {
	const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	icon.setAttribute("viewBox", "0 0 26 26");
	icon.setAttribute("aria-hidden", "true");
	icon.setAttribute("focusable", "false");
	icon.setAttribute("style", arrowStyle);
	icon.classList.add("site-arrow");
	path.setAttribute("d", arrowPath);
	path.setAttribute("transform", `translate(0 3) rotate(${arrowAngles[direction]} 13 10)`);
	icon.append(path);
	return icon;
};
