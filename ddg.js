/**
 * ddg.js
 * Minimal DuckDuckGo server-side helpers:
 * - ddgImageSearch(q) -> returns array of image results {title, source, thumbnail}
 * - ddgLinkSearch(q)  -> returns array of link results {title, link, snippet}
 *
 * It uses DuckDuckGo endpoints used by the public site. This is scraping-like behavior:
 * it may break if DDG changes their internals.
 */

import fetch from "node:node-fetch";
import cheerio from "cheerio";

function safeUrlEncode(s) {
  return encodeURIComponent(s);
}

export async function ddgImageSearch(q) {
  // Step 1: get vqd token from main page
  const hostUrl = `https://duckduckgo.com/?q=${safeUrlEncode(q)}`;
  const r1 = await fetch(hostUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible)" } });
  const body = await r1.text();

  // extract vqd token
  const m = body.match(/vqd='([^']+)'/);
  const vqd = m ? m[1] : null;

  // fallback: try without vqd (may still work sometimes)
  const iUrlBase = "https://duckduckgo.com/i.js";
  const params = new URLSearchParams({ q, l: "us-en" });
  if (vqd) params.set("vqd", vqd);
  const iUrl = `${iUrlBase}?${params.toString()}`;

  const r2 = await fetch(iUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible)", Accept: "application/json" }
  });
  if (!r2.ok) {
    // if DuckDuckGo returns non-OK, return empty array
    return [];
  }
  const json = await r2.json();
  const results = (json?.results || []).map(it => ({
    title: it.title || null,
    source: it.image || it.original || null,
    thumbnail: it.thumbnail || null,
    url: it.url || it.source || null
  }));
  return results;
}

export async function ddgLinkSearch(q) {
  // use DDG html results
  const url = `https://duckduckgo.com/html/?q=${safeUrlEncode(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible)" } });
  const html = await r.text();
  const $ = cheerio.load(html);

  const results = [];
  $(".result__body").each((i, el) => {
    const a = $(el).find("a.result__a");
    const title = a.text().trim();
    let href = a.attr("href");
    // DuckDuckGo returns redirect /l/?kh=-1&uddg=<encoded-url> sometimes; attempt to decode
    if (href && href.includes("/l/?kh=") && href.includes("uddg=")) {
      const m = href.match(/uddg=([^&]+)/);
      if (m) {
        try {
          href = decodeURIComponent(m[1]);
        } catch (e) {}
      }
    }
    const snippet = $(el).find(".result__snippet").text().trim();
    if (href && title) results.push({ title, link: href, snippet });
  });

  // fallback: anchor tags
  if (results.length === 0) {
    $("a.result__a").each((i, a) => {
      const title = $(a).text().trim();
      let href = $(a).attr("href");
      if (href && title) results.push({ title, link: href });
    });
  }
  return results;
}
