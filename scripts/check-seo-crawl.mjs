const canonicalOrigin = "https://www.atoman.org";
const browserAgent =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36";
const inspectionAgent =
	process.env.SEO_CRAWLER_USER_AGENT?.trim() || "Google-InspectionTool/1.0";

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
	return [...html.matchAll(/<meta\b[^>]*>/gi)].some((match) => {
		const tag = match[0];
		return /\bname=["']robots["']/i.test(tag) &&
			/\bcontent=["'][^"']*noindex/i.test(tag);
	});
}

function canonicalHref(html) {
	const tag = html.match(
		/<link\b[^>]*\brel=["'][^"']*canonical[^"']*["'][^>]*>/i,
	)?.[0];
	return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
}

function decodeXml(value) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function sitemapUrls(sitemapBody) {
	return [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
		decodeXml(match[1].trim()),
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
		!/noindex/i.test(response.headers.get("x-robots-tag") || ""),
		`${agentName} received an x-robots-tag noindex for ${url}`,
	);
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
	check(
		canonicalHref(body) === url,
		`${url} has canonical ${canonicalHref(body) || "nothing"}`,
	);
}

function discoverContentUrl(urls) {
	const configured = process.env.SEO_CONTENT_URL?.trim();
	if (configured) return new URL(configured, canonicalOrigin).toString();
	return urls.find((url) => /\/posts\/post\//.test(url)) || "";
}

async function inspectPages(urls) {
	const pending = [...urls];
	const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
		while (pending.length) {
			const url = pending.shift();
			if (url) await inspectHtml(url, "sitemap", browserAgent);
		}
	});
	await Promise.all(workers);
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
let indexedUrls = [];
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
	indexedUrls = sitemapUrls(sitemapBody);
	check(indexedUrls.length > 0, "sitemap.xml does not contain any URLs");
	check(
		new Set(indexedUrls).size === indexedUrls.length,
		"sitemap.xml contains duplicate URLs",
	);
	indexedUrls.forEach((url) => {
		try {
			const parsed = new URL(url);
			check(
				parsed.origin === canonicalOrigin && !parsed.search && !parsed.hash,
				`sitemap URL is not a clean canonical URL: ${url}`,
			);
		} catch {
			failures.push(`sitemap contains an invalid URL: ${url}`);
		}
	});
}

const contentUrl = discoverContentUrl(indexedUrls);
const pages = new Set([`${canonicalOrigin}/`, `${canonicalOrigin}/feed`, ...indexedUrls]);
if (contentUrl) pages.add(contentUrl);
else
	failures.push(
		"No public content URL found; set SEO_CONTENT_URL to inspect a published content page",
	);

await inspectPages([...pages]);
await inspectHtml(`${canonicalOrigin}/`, "inspection", inspectionAgent);

if (failures.length) {
	console.error(`\nSEO crawl check failed (${failures.length}):`);
	failures.forEach((failure) => console.error(`- ${failure}`));
	process.exitCode = 1;
} else {
	console.log("\nSEO crawl check passed");
}
