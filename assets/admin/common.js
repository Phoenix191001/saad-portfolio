import { CLOUDINARY } from "/assets/cloudinary-config.js";

export const MAX_IMAGE_MB = 8;

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Accepts watch?v=, youtu.be/, shorts/, embed/, live/ links. Returns the 11-character id or null.
export function parseYouTubeId(input) {
  let url;
  try { url = new URL(String(input).trim()); } catch (e) { return null; }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/);
      if (m) id = m[1];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function readingTimeMinutes(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function parseTags(text) {
  const seen = new Set();
  return String(text || "")
    .split(",")
    .map((t) => slugify(t))
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .slice(0, 10);
}

// Uploads an image to Cloudinary (unsigned preset). Returns the https URL.
export async function uploadImage(file, onProgress) {
  if (!file || !/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
    throw new Error("Please choose a JPG, PNG, WebP, GIF or AVIF image.");
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error("That image is over " + MAX_IMAGE_MB + " MB. Please choose a smaller one.");
  }
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", CLOUDINARY.uploadPreset);
  const endpoint = "https://api.cloudinary.com/v1_1/" + CLOUDINARY.cloudName + "/image/upload";
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
      else reject(new Error((data.error && data.error.message) || "Upload failed. Check the Cloudinary preset."));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(body);
  });
}

export function toMillis(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
}

export function fmtDate(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Cloudinary delivery transform (auto format and quality, width limit).
export function cld(url, transform) {
  if (typeof url !== "string") return "";
  const t = transform || "f_auto,q_auto,w_900";
  return /^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\//.test(url)
    ? url.replace("/image/upload/", "/image/upload/" + t + "/")
    : url;
}
