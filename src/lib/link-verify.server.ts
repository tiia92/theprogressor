// Server-only: fetches reader-submitted links so the Crowdsource desk can read the
// actual page instead of trusting whatever title/outlet the reader claims.

export interface LinkFacts {
  url: string;
  ok: boolean;
  status?: number;
  finalUrl?: string;
  domain?: string;
  title?: string;
  siteName?: string;
  description?: string;
  publishedTime?: string;
  author?: string;
  excerpt?: string;
  error?: string;
}

const MAX_BYTES = 400_000;
const TIMEOUT_MS = 12_000;

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>()"'\]]+/gi) ?? [];
  const out: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?]+$/, "");
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  return out.slice(0, 3);
}

function meta(html: string, attr: "property" | "name", key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    "i",
  );
  const m = html.match(re) ?? html.match(alt);
  return m?.[1]?.trim() || undefined;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function textBody(html: string) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decode(body).replace(/\s+/g, " ").trim().slice(0, 2000);
}

export async function fetchLinkFacts(url: string): Promise<LinkFacts> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, ok: false, error: "not a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url, ok: false, error: "unsupported protocol" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheProgressorBot/1.0; +https://theprogressor.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!resp.ok) {
      return {
        url,
        ok: false,
        status: resp.status,
        domain: parsed.hostname.replace(/^www\./, ""),
        error: `server returned ${resp.status}`,
      };
    }

    const raw = await resp.text();
    const html = raw.slice(0, MAX_BYTES);
    const finalUrl = resp.url || parsed.toString();
    const domain = new URL(finalUrl).hostname.replace(/^www\./, "");
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

    return {
      url,
      ok: true,
      status: resp.status,
      finalUrl,
      domain,
      title: decode((meta(html, "property", "og:title") ?? titleTag ?? "").trim()) || undefined,
      siteName: meta(html, "property", "og:site_name"),
      description:
        meta(html, "property", "og:description") ?? meta(html, "name", "description"),
      publishedTime:
        meta(html, "property", "article:published_time") ??
        meta(html, "name", "pubdate") ??
        meta(html, "name", "date"),
      author: meta(html, "name", "author") ?? meta(html, "property", "article:author"),
      excerpt: textBody(html),
    };
  } catch (err) {
    return {
      url,
      ok: false,
      domain: parsed.hostname.replace(/^www\./, ""),
      error: err instanceof Error ? err.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAllLinkFacts(urls: string[]): Promise<LinkFacts[]> {
  return Promise.all(urls.map(fetchLinkFacts));
}

export function formatLinkFacts(facts: LinkFacts[]): string {
  if (!facts.length) return "";
  const blocks = facts.map((f) => {
    if (!f.ok) {
      return `URL: ${f.url}\nFETCH FAILED: ${f.error ?? "unknown error"}. The page could not be retrieved, so nothing about it is verified.`;
    }
    return [
      `URL: ${f.finalUrl ?? f.url}`,
      `Domain (verified): ${f.domain}`,
      `Page title (verified): ${f.title ?? "(none found)"}`,
      f.siteName ? `Site name (verified): ${f.siteName}` : null,
      f.author ? `Byline (verified): ${f.author}` : null,
      f.publishedTime ? `Published (verified): ${f.publishedTime}` : null,
      f.description ? `Description (verified): ${f.description}` : null,
      `Page text (verified, truncated): ${f.excerpt ?? "(no readable text)"}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `VERIFIED LINK DATA — fetched directly from the web by the desk just now. This is ground truth; the reader's description is not.\n\n${blocks.join("\n\n---\n\n")}`;
}
