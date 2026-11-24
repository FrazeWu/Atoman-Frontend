export async function onRequest() {
  const urls = [
    "https://api.atoman.org/api/v1/blog/posts?page=1&page_size=2&view=summary",
    "https://api.atoman.org/api/v1/music/songs?page=1&page_size=2&view=summary",
  ];
  const outcomes = await Promise.all(urls.map(async (url) => {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      return {
        endpoint: new URL(url).pathname,
        status: response.status,
        contentType: response.headers.get("content-type"),
        cfMitigated: response.headers.get("cf-mitigated"),
        size: (await response.text()).length,
      };
    } catch (err) {
      return { endpoint: new URL(url).pathname, error: String(err).slice(0, 130) };
    }
  }));
  return new Response(JSON.stringify(outcomes), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
