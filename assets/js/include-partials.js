async function fetchHtml(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.text();
}

function ensureHeadNode(node) {
  if (!(node instanceof Element)) return;

  if (node.tagName === "LINK" && node.getAttribute("rel") === "stylesheet") {
    const href = node.getAttribute("href");
    if (!href) return;
    const exists = Array.from(document.querySelectorAll(`link[rel="stylesheet"]`)).some(
      (l) => l.getAttribute("href") === href,
    );
    if (!exists) document.head.appendChild(node);
    return;
  }

  if (node.tagName === "SCRIPT") {
    const src = node.getAttribute("src");
    if (!src) return;
    const exists = Array.from(document.querySelectorAll("script[src]")).some(
      (s) => s.getAttribute("src") === src,
    );
    if (!exists) document.head.appendChild(node);
    return;
  }

  if (node.tagName === "STYLE") {
    const content = node.textContent || "";
    const exists = Array.from(document.querySelectorAll("style")).some(
      (s) => (s.textContent || "") === content,
    );
    if (!exists) document.head.appendChild(node);
    return;
  }

  if (node.tagName === "META" || node.tagName === "TITLE") {
    document.head.appendChild(node);
    return;
  }
}

async function includeDocument(url, mountEl, { mergeHead } = { mergeHead: false }) {
  const html = await fetchHtml(url);
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (mergeHead && doc.head) {
    Array.from(doc.head.children).forEach((child) => ensureHeadNode(child.cloneNode(true)));
  }

  if (doc.body) {
    mountEl.innerHTML = doc.body.innerHTML;
  } else {
    mountEl.innerHTML = html;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const mounts = Array.from(document.querySelectorAll("[data-include]"));
  const headerMount = mounts.find((m) => m.getAttribute("data-include") === "includes/header.html");
  const footerMount = mounts.find((m) => m.getAttribute("data-include") === "includes/footer.html");

  try {
    if (headerMount) await includeDocument("includes/header.html", headerMount, { mergeHead: true });
    if (footerMount) await includeDocument("includes/footer.html", footerMount, { mergeHead: false });
  } catch (e) {
    // If partials fail to load (e.g., opened as file://), keep page usable.
    console.error(e);
  }

  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
});
