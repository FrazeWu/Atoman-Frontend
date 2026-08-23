const DEFAULT_DESKTOP_APP_URL = "https://www.atoman.org";
const LOCAL_DESKTOP_APP_URL = "http://localhost:5173";

export function desktopAppBaseUrl() {
	const configured = import.meta.env.VITE_DESKTOP_APP_URL?.trim();
	if (configured && configured !== "undefined")
		return configured.replace(/\/$/, "");
	if (import.meta.env.PROD) return DEFAULT_DESKTOP_APP_URL;
	if (typeof window !== "undefined" && window.location.port === "5174")
		return LOCAL_DESKTOP_APP_URL;
	return "";
}

export function desktopAppPath(path: string) {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const baseUrl = desktopAppBaseUrl();
	return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
