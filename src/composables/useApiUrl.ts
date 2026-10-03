export function useApiUrl() {
	const configuredUrl = import.meta.env.VITE_API_URL?.trim();
	const baseUrl =
		configuredUrl && configuredUrl !== "undefined" ? configuredUrl : "/api/v1";
	const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

	if (normalizedBaseUrl.endsWith("/api/v1")) return normalizedBaseUrl;
	if (normalizedBaseUrl.endsWith("/api")) return `${normalizedBaseUrl}/v1`;
	return `${normalizedBaseUrl}/api/v1`;
}

export function useWebSocketUrl(path: string) {
	const apiUrl = useApiUrl();

	if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
		try {
			const url = new URL(apiUrl);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			url.pathname = path;
			url.search = "";
			url.hash = "";
			return url.toString();
		} catch {
			return path;
		}
	}

	if (typeof window !== "undefined") {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${protocol}//${window.location.host}${path}`;
	}

	return path;
}

export function useApiWebSocketUrl(path: string) {
	const apiUrl = useApiUrl();
	let apiPath = apiUrl;
	if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
		try {
			apiPath = new URL(apiUrl).pathname;
		} catch {
			apiPath = "/api/v1";
		}
	}
	const normalizedPath = path.replace(/^\/+/, "");
	return useWebSocketUrl(`${apiPath.replace(/\/$/, "")}/${normalizedPath}`);
}
