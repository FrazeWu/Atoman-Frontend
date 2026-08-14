const canonicalOrigin = "https://www.atoman.org";
const browserAgent =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36";
const spoofedCrawlerAgents = {
	googlebot:
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	bingbot:
		"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
};

const failures = [];

async function request(url, userAgent, redirect = "manual") {
	try {
		return await fetch(url, {
			headers: {
				accept: "text/html,application/xml,text/plain",
				"user-agent": userAgent,
			},
			redirect,
			signal: AbortSignal.timeout(15_000),
		});
	} catch (error) {
		failures.push(
			`${url}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

function check(condition, message) {
	if (!condition) failures.push(message);
}

function containsNoindex(html) {
	return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(
		html,
	);
}

async function inspectHtml(url, agentName, userAgent) {
	const response = await request(url, userAgent);
	if (!response) return;
	const body = await response.text();
	console.log(`${agentName.padEnd(9)} ${response.status} ${url}`);
	check(
		response.status === 200,
		`${agentName} expected 200 for ${url}, received ${response.status}`,
	);
	check(!containsNoindex(body), `${agentName} received noindex for ${url}`);
	check(
		/<title[^>]*>[^<]+<\/title>/i.test(body),
		`${url} is missing a server-rendered title`,
	);
	check(
		/<meta[^>]+name=["']description["']/i.test(body),
		`${url} is missing a server-rendered description`,
	);
	check(
		/<link[^>]+rel=["']canonical["']/i.test(body),
		`${url} is missing a server-rendered canonical`,
	);
}

async function discoverContentUrl(sitemapBody) {
	const configured = process.env.SEO_CONTENT_URL?.trim();
	if (configured) return new URL(configured, canonicalOrigin).toString();
	const urls = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
		(match) => match[1],
	);
	return urls.find((url) => /\/posts\/post\//.test(url)) || "";
}

const apex = await request("https://atoman.org/", browserAgent);
if (apex) {
	console.log(`redirect  ${apex.status} https://atoman.org/`);
	check(apex.status === 301, `apex expected 301, received ${apex.status}`);
	check(
		apex.headers.get("location") === `${canonicalOrigin}/`,
		`apex redirects to ${apex.headers.get("location") || "nothing"}`,
	);
}

const robots = await request(`${canonicalOrigin}/robots.txt`, browserAgent);
if (robots) {
	const body = await robots.text();
	console.log(`browser   ${robots.status} ${canonicalOrigin}/robots.txt`);
	check(
		robots.status === 200,
		`robots.txt expected 200, received ${robots.status}`,
	);
	check(
		body.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`),
		"robots.txt does not reference the canonical sitemap",
	);
}

const sitemap = await request(`${canonicalOrigin}/sitemap.xml`, browserAgent);
let sitemapBody = "";
if (sitemap) {
	sitemapBody = await sitemap.text();
	console.log(`browser   ${sitemap.status} ${canonicalOrigin}/sitemap.xml`);
	check(
		sitemap.status === 200,
		`sitemap.xml expected 200, received ${sitemap.status}`,
	);
	check(sitemapBody.includes("<urlset"), "sitemap.xml is not a sitemap urlset");
	check(
		sitemapBody.includes(`<loc>${canonicalOrigin}/</loc>`),
		"sitemap.xml is missing the homepage",
	);
}

const contentUrl = await discoverContentUrl(sitemapBody);
const pages = [`${canonicalOrigin}/`, `${canonicalOrigin}/feed`];
if (contentUrl) pages.push(contentUrl);
else
	failures.push(
		"No public content URL found; set SEO_CONTENT_URL to inspect a published content page",
	);

for (const url of pages) await inspectHtml(url, "browser", browserAgent);

for (const [agentName, userAgent] of Object.entries(spoofedCrawlerAgents)) {
	const response = await request(`${canonicalOrigin}/`, userAgent);
	if (!response) continue;
	console.log(
		`spoof:${agentName.padEnd(7)} ${response.status} ${canonicalOrigin}/`,
	);
	check(
		response.status === 403,
		`${agentName} User-Agent spoof expected 403, received ${response.status}`,
	);
}

if (failures.length) {
	console.error(`\nSEO crawl check failed (${failures.length}):`);
	failures.forEach((failure) => console.error(`- ${failure}`));
	process.exitCode = 1;
} else {
	console.log("\nSEO crawl check passed");
}
