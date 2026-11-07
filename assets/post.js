import { fetchBySlug, SITE } from "/assets/blog-data.js";
import { sanitizeHtml } from "/assets/sanitize-bundle.js";
import { toMillis, fmtDate, cld } from "/assets/admin/common.js";

const $ = (id) => document.getElementById(id);
const slug = decodeURIComponent(location.pathname.replace(/\/+$/, "").split("/").pop() || "");

function setMeta(sel, attr, value) {
  const el = document.querySelector(sel);
  if (el) el.setAttribute(attr, value);
}

function notFound() {
  $("post-status").remove();
  $("post-missing").hidden = false;
  document.title = "Post not found | Saad Azfar";
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex";
  document.head.appendChild(robots);
}

try {
  const p = slug && slug !== "post.html" ? await fetchBySlug(slug) : null;
  if (!p) throw new Error("not-found");

  const title = (p.seo && p.seo.metaTitle) || p.title;
  const desc = (p.seo && p.seo.metaDescription) || p.excerpt || "";
  const url = SITE + "/blog/" + encodeURIComponent(p.slug);
  const image = p.coverImage && p.coverImage.url ? cld(p.coverImage.url, "f_auto,q_auto,w_1200,h_630,c_fill") : SITE + "/og-image.png";

  document.title = title + " | Saad Azfar";
  setMeta('meta[name="description"]', "content", desc);
  setMeta('link[rel="canonical"]', "href", url);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", desc);
  setMeta('meta[property="og:url"]', "content", url);
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", desc);
  setMeta('meta[name="twitter:image"]', "content", image);

  $("post-title").textContent = p.title;
  $("post-meta").textContent = [fmtDate(toMillis(p.publishedAt)), (p.readingTime || 1) + " min read"].filter(Boolean).join(" · ");
  (p.tags || []).forEach((t) => {
    const s = document.createElement("span");
    s.className = "stack-tag";
    s.textContent = t;
    $("post-tags").appendChild(s);
  });
  if (p.coverImage && p.coverImage.url) {
    $("post-cover-img").src = cld(p.coverImage.url, "f_auto,q_auto,w_1400");
    $("post-cover-img").alt = p.coverImage.alt || "";
    $("post-cover").hidden = false;
  }
  $("post-body").innerHTML = sanitizeHtml(p.contentHtml);

  const enc = encodeURIComponent;
  $("share-x").href = "https://twitter.com/intent/tweet?text=" + enc(p.title) + "&url=" + enc(url);
  $("share-linkedin").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(url);
  $("share-whatsapp").href = "https://wa.me/?text=" + enc(p.title + " " + url);
  $("share-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      $("share-copy").querySelector("span").textContent = "Copied!";
      setTimeout(() => { $("share-copy").querySelector("span").textContent = "Copy link"; }, 2000);
    } catch (e) { /* clipboard unavailable */ }
  });

  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: desc,
    image: [image],
    datePublished: toMillis(p.publishedAt) ? new Date(toMillis(p.publishedAt)).toISOString() : undefined,
    dateModified: toMillis(p.updatedAt) ? new Date(toMillis(p.updatedAt)).toISOString() : undefined,
    author: { "@type": "Person", name: "Saad Azfar" },
    mainEntityOfPage: url,
  });
  document.head.appendChild(ld);

  $("post-status").remove();
  $("post").hidden = false;
} catch (e) {
  if (e.message !== "not-found") {
    console.error(e);
    $("post-status").textContent = "Could not load this post. Please try again later.";
  } else notFound();
}
