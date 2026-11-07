import { fetchPublished } from "/assets/blog-data.js";
import { toMillis, fmtDate, cld } from "/assets/admin/common.js";

const PAGE_SIZE = 9;
const grid = document.getElementById("post-grid");
const statusEl = document.getElementById("blog-status");
const searchEl = document.getElementById("blog-search");
const tagBox = document.getElementById("tag-filter");
const moreBtn = document.getElementById("load-more");

let all = [];
let activeTag = "";
let shown = PAGE_SIZE;

function card(p) {
  const a = document.createElement("a");
  a.className = "post-card card";
  a.href = "/blog/" + encodeURIComponent(p.slug);

  const cover = document.createElement("div");
  cover.className = "post-card-cover";
  if (p.coverImage && p.coverImage.url) {
    const img = document.createElement("img");
    img.src = cld(p.coverImage.url, "f_auto,q_auto,w_640,c_fill,ar_16:9");
    img.alt = p.coverImage.alt || "";
    img.loading = "lazy";
    cover.appendChild(img);
  }
  a.appendChild(cover);

  const body = document.createElement("div");
  body.className = "post-card-body";
  if (Array.isArray(p.tags) && p.tags.length) {
    const tags = document.createElement("div");
    tags.className = "post-tags";
    p.tags.slice(0, 3).forEach((t) => {
      const s = document.createElement("span");
      s.className = "stack-tag";
      s.textContent = t;
      tags.appendChild(s);
    });
    body.appendChild(tags);
  }
  const h = document.createElement("h2");
  h.textContent = p.title || "Untitled";
  body.appendChild(h);
  const ex = document.createElement("p");
  ex.className = "excerpt";
  ex.textContent = p.excerpt || "";
  body.appendChild(ex);
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = [fmtDate(toMillis(p.publishedAt)), (p.readingTime || 1) + " min read"].filter(Boolean).join(" · ");
  body.appendChild(meta);
  a.appendChild(body);
  return a;
}

function filtered() {
  const q = searchEl.value.trim().toLowerCase();
  return all.filter((p) => {
    if (activeTag && !(p.tags || []).includes(activeTag)) return false;
    if (!q) return true;
    return ((p.title || "") + " " + (p.excerpt || "") + " " + (p.tags || []).join(" ")).toLowerCase().includes(q);
  });
}

function render() {
  const list = filtered();
  grid.replaceChildren(...list.slice(0, shown).map(card));
  moreBtn.hidden = list.length <= shown;
  statusEl.textContent = list.length
    ? ""
    : all.length ? "No posts match your search." : "No posts yet. Check back soon.";
}

function renderTags() {
  const tags = [...new Set(all.flatMap((p) => p.tags || []))].sort();
  tagBox.replaceChildren(...tags.map((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tag-chip";
    b.textContent = t;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      activeTag = activeTag === t ? "" : t;
      tagBox.querySelectorAll(".tag-chip").forEach((c) => c.setAttribute("aria-pressed", String(c.textContent === activeTag)));
      shown = PAGE_SIZE;
      render();
    });
    return b;
  }));
}

searchEl.addEventListener("input", () => { shown = PAGE_SIZE; render(); });
moreBtn.addEventListener("click", () => { shown += PAGE_SIZE; render(); });

try {
  all = await fetchPublished();
  renderTags();
  render();
} catch (e) {
  console.error(e);
  statusEl.textContent = "Could not load posts. Please try again later.";
}
