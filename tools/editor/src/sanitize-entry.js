// Bundled into assets/sanitize-bundle.js. Used by the editor and the public post page.
import DOMPurify from "dompurify";

const YT = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}(\?[A-Za-z0-9_=&%.\-]*)?$/;

export function sanitizeHtml(html) {
  const clean = DOMPurify.sanitize(String(html || ""), {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "allow", "data-youtube-video", "target", "rel"],
  });
  const tpl = document.createElement("template");
  tpl.innerHTML = clean;
  // Only YouTube (no-cookie) iframes are allowed.
  tpl.content.querySelectorAll("iframe").forEach((f) => {
    if (!YT.test(f.getAttribute("src") || "")) f.remove();
    else {
      f.setAttribute("loading", "lazy");
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    }
  });
  // Images must be https.
  tpl.content.querySelectorAll("img").forEach((img) => {
    if (!/^https:\/\//i.test(img.getAttribute("src") || "")) img.remove();
    else img.setAttribute("loading", "lazy");
  });
  // Links open safely; task checkboxes are read-only.
  tpl.content.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!/^(https?:|mailto:|\/|#)/i.test(href)) a.removeAttribute("href");
    if (/^https?:/i.test(href)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
  tpl.content.querySelectorAll('input[type="checkbox"]').forEach((i) => i.setAttribute("disabled", ""));
  return tpl.innerHTML;
}
