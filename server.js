/**
 * server.js
 * Simple Express backend serving a static frontend and an API endpoint /api/search
 *
 * Environment variables:
 * - GOOGLE_API_KEY (optional)
 * - GOOGLE_CX (optional)
 * - SERPAPI_KEY (optional)
 *
 * If neither Google nor SerpAPI keys are present, DuckDuckGo fallback is used.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cheerio from "cheerio";

import { ddgImageSearch, ddgLinkSearch } from "./ddg.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Helper: randomly pick one item from array
function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Google Custom Search call (images or links)
async function googleSearch(q, type = "image") {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!apiKey || !cx) throw new Error("Google API key (GOOGLE_API_KEY) or CX (GOOGLE_CX) missing.");
  const base = "https://www.googleapis.com/customsearch/v1";
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q
  });
  if (type === "image") params.set("searchType", "image");
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google API error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  if (!data.items || data.items.length === 0) return [];
  if (type === "image") {
    return data.items.map(it => ({
      title: it.title || null,
      source: it.link,
      thumbnail: it.image?.thumbnailLink || null,
      contextLink: it.image?.contextLink || null
    }));
  } else {
    return data.items.map(it => ({
      title: it.title || null,
      link: it.link,
      snippet: it.snippet || null
    }));
  }
}

// SerpAPI call (optional)
async function serpApiSearch(q, type = "image") {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY missing.");
  const params = new URLSearchParams({ api_key: key, q, engine: "google" });
  if (type === "image") params.set("tbm", "isch");
  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json();
  if (type === "image") {
    const images = data.images_results || [];
    return images.map(it => ({ title: it.title, source: it.original || it.source, thumbnail: it.thumbnail }));
  } else {
    const results = data.organic_results || [];
    return results.map(r => ({ title: r.title, link: r.link, snippet: r.snippet }));
  }
}

// DuckDuckGo links search implemented using html endpoint + cheerio (server-side scraping)
async function ddgLinkSearchWrapper(q) {
  return ddgLinkSearch(q);
}

// DuckDuckGo image search wrapper
async function ddgImageSearchWrapper(q) {
  return ddgImageSearch(q);
}

// API: /api/search
// Query parameters:
// - q (keyword) [required]
// - provider (google|serpapi|duckduckgo) [optional; "auto" by default]
// - type (image|link) [optional; defaults to image]
app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing query parameter 'q'." });
    const type = req.query.type === "link" ? "link" : "image";
    let provider = (req.query.provider || "auto").toLowerCase();

    // provider selection logic
    if (provider === "auto") {
      if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX) provider = "google";
      else if (process.env.SERPAPI_KEY) provider = "serpapi";
      else provider = "duckduckgo";
    }

    let items = [];
    if (provider === "google") {
      items = await googleSearch(q, type);
    } else if (provider === "serpapi") {
      items = await serpApiSearch(q, type);
    } else if (provider === "duckduckgo") {
      if (type === "image") items = await ddgImageSearchWrapper(q);
      else items = await ddgLinkSearchWrapper(q);
    } else {
      return res.status(400).json({ error: `Unknown provider '${provider}'. Use google|serpapi|duckduckgo|auto.` });
    }

    // pick random result
    const chosen = pickRandom(items);
    res.json({ provider, type, count: items.length, result: chosen || null });
  } catch (err) {
    console.error("api error", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Fallback route - serve index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Keyword Surprise listening on port ${port}`);
});
