export function isStandaloneMobileApp() {
	return (
		typeof document !== "undefined" &&
		document.documentElement.dataset.atomanApp === "mobile"
	);
}
