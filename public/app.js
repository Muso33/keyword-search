// client-side app.js
const form = document.getElementById("searchForm");
const qInput = document.getElementById("q");
const typeSelect = document.getElementById("type");
const providerSelect = document.getElementById("provider");
const status = document.getElementById("status");
const resultDiv = document.getElementById("result");
const anotherBtn = document.getElementById("another");

let lastQuery = null;
let lastProvider = null;
let lastType = null;

async function fetchResult(q, type, provider) {
  status.textContent = "Searching...";
  resultDiv.innerHTML = "";
  try {
    const params = new URLSearchParams({ q, type, provider });
    const res = await fetch(`/api/search?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Unknown error");
    status.textContent = `Provider: ${json.provider} — ${json.count || 0} results found`;
    const r = json.result;
    if (!r) {
      resultDiv.innerHTML = `<div class="muted">No result found. Try another keyword.</div>`;
      return;
    }
    if (type === "image") {
      const img = document.createElement("img");
      img.src = r.source || r.url || r.thumbnail;
      img.alt = r.title || "Image result";
      img.onload = () => {};
      img.onerror = () => {
        resultDiv.innerHTML = `<div class="muted">Image failed to load — <a href="${r.source || r.url}" target="_blank" rel="noreferrer">open link</a></div>`;
      };
      const caption = document.createElement("div");
      caption.innerHTML = `<div style="text-align:center;margin-top:8px;"><div>${r.title || ""}</div><a class="result-link" href="${r.url || r.source || '#'}" target="_blank" rel="noreferrer">Open source</a></div>`;
      resultDiv.appendChild(img);
      resultDiv.appendChild(caption);
    } else {
      // link
      const a = document.createElement("a");
      a.className = "result-link";
      a.href = r.link || r.url || "#";
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = r.title || (r.link || r.url);
      const snippet = document.createElement("div");
      snippet.className = "muted";
      snippet.style.marginTop = "8px";
      snippet.textContent = r.snippet || "";
      resultDiv.appendChild(a);
      resultDiv.appendChild(snippet);
    }
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    resultDiv.innerHTML = `<div class="muted">Try a different provider (Auto | DuckDuckGo) or check server logs.</div>`;
  }
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const q = qInput.value.trim();
  if (!q) return;
  const type = typeSelect.value;
  const provider = providerSelect.value;
  lastQuery = q;
  lastProvider = provider;
  lastType = type;
  await fetchResult(q, type, provider);
});

anotherBtn.addEventListener("click", async () => {
  if (!lastQuery) return;
  await fetchResult(lastQuery, lastType, lastProvider);
});
