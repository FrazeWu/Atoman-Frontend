// The Pages service binding invokes a private Worker, bypassing the public
// API hostname's Bot Fight challenge without exposing a new public endpoint.
export type SeoOriginBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export function createSeoApiFetcher(binding?: SeoOriginBinding): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL ? input.href : input.url;
    let url: URL;
    try {
      url = new URL(requestUrl);
    } catch {
      return fetch(input, init);
    }
    if (!binding || url.origin !== "https://api.atoman.org" ||
        !url.pathname.startsWith("/api/v1/")) {
      return fetch(input, init);
    }
    // Only GET public data. Never forward the visitor's cookies or auth.
    return binding.fetch(url.href, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: init?.signal,
    });
  }) as typeof fetch;
}
