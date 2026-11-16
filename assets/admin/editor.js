import { db } from "/assets/firebase-config.js";
import { requireAdmin } from "/assets/admin/guard.js";
import {
  slugify, parseYouTubeId, readingTimeMinutes, parseTags, uploadImage, toMillis, fmtDate, cld,
} from "/assets/admin/common.js";
import { createEditor } from "/assets/admin/editor-bundle.js";
import { sanitizeHtml } from "/assets/sanitize-bundle.js";
import {
  collection, doc, getDoc, writeBatch, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
await requireAdmin();

// ---------- state ----------
let postId = new URLSearchParams(location.search).get("id");
let existing = null;          // last saved Firestore data
let cover = null;             // { url, alt }
let dirty = false;
let saving = false;
let slugTouched = false;

function toast(msg, isError) {
  const t = document.createElement("div");
  t.className = "toast" + (isError ? " error" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function setState(text) { $("save-state").textContent = text; }
function markDirty() {
  dirty = true;
  if (!saving) setState("Unsaved changes");
}

// ---------- editor ----------
const editor = createEditor({
  element: $("editor"),
  placeholder: "Write your story. Type / for commands.",
  onChange: (ed, selectionOnly) => {
    refreshToolbar();
    updateSlash();
    if (!selectionOnly) { markDirty(); updateCounts(); }
  },
});

function updateCounts() {
  const words = editor.storage.characterCount.words();
  $("count").textContent = words + (words === 1 ? " word" : " words");
  $("read-time").textContent = readingTimeMinutes(editor.getText()) + " min read";
}

const chain = () => editor.chain().focus();

// Insert block nodes followed by an empty paragraph with the cursor in it, so the
// next insert never replaces the block that was just added.
function insertBlocks(nodes) {
  chain().insertContent([...nodes, { type: "paragraph" }]).run();
}

// Make sure there is always a paragraph after a trailing table, without moving the cursor.
function ensureTrailingParagraph() {
  const { doc, selection } = editor.state;
  if (doc.lastChild && doc.lastChild.type.name !== "paragraph") {
    const pos = selection.from;
    editor.chain().insertContentAt(doc.content.size, { type: "paragraph" }).setTextSelection(pos).run();
  }
}

async function pickAndInsertImage(file) {
  try {
    toast("Uploading image...");
    const url = await uploadImage(file);
    const alt = (prompt("Describe the image for screen readers (alt text):", "") || "").trim();
    insertBlocks([{ type: "image", attrs: { src: cld(url, "f_auto,q_auto,w_1400"), alt } }]);
  } catch (e) { toast(e.message, true); }
}

function insertYoutube() {
  const input = prompt("Paste a YouTube link:");
  if (!input) return;
  if (!parseYouTubeId(input)) { toast("That does not look like a YouTube video link.", true); return; }
  insertBlocks([{ type: "youtube", attrs: { src: input.trim(), width: 640, height: 360 } }]);
}

function setLink() {
  const prev = editor.getAttributes("link").href || "";
  const url = prompt("Link URL (leave empty to remove):", prev);
  if (url === null) return;
  if (url.trim() === "") { chain().extendMarkRange("link").unsetLink().run(); return; }
  const href = /^(https?:|mailto:|\/|#)/i.test(url.trim()) ? url.trim() : "https://" + url.trim();
  chain().extendMarkRange("link").setLink({ href }).run();
}

const COMMANDS = {
  undo: () => chain().undo().run(),
  redo: () => chain().redo().run(),
  bold: () => chain().toggleBold().run(),
  italic: () => chain().toggleItalic().run(),
  underline: () => chain().toggleUnderline().run(),
  strike: () => chain().toggleStrike().run(),
  code: () => chain().toggleCode().run(),
  highlight: () => chain().toggleHighlight().run(),
  clearColor: () => chain().unsetColor().run(),
  bulletList: () => chain().toggleBulletList().run(),
  orderedList: () => chain().toggleOrderedList().run(),
  taskList: () => chain().toggleTaskList().run(),
  blockquote: () => chain().toggleBlockquote().run(),
  codeBlock: () => chain().toggleCodeBlock().run(),
  hr: () => chain().setHorizontalRule().run(),
  alignLeft: () => chain().setTextAlign("left").run(),
  alignCenter: () => chain().setTextAlign("center").run(),
  alignRight: () => chain().setTextAlign("right").run(),
  link: setLink,
  image: () => $("inline-file").click(),
  youtube: insertYoutube,
  table: () => { chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); ensureTrailingParagraph(); },
  rowAfter: () => chain().addRowAfter().run(),
  colAfter: () => chain().addColumnAfter().run(),
  delRow: () => chain().deleteRow().run(),
  delCol: () => chain().deleteColumn().run(),
  delTable: () => chain().deleteTable().run(),
  clear: () => chain().unsetAllMarks().clearNodes().run(),
};

const ACTIVE = {
  bold: () => editor.isActive("bold"),
  italic: () => editor.isActive("italic"),
  underline: () => editor.isActive("underline"),
  strike: () => editor.isActive("strike"),
  code: () => editor.isActive("code"),
  highlight: () => editor.isActive("highlight"),
  bulletList: () => editor.isActive("bulletList"),
  orderedList: () => editor.isActive("orderedList"),
  taskList: () => editor.isActive("taskList"),
  blockquote: () => editor.isActive("blockquote"),
  codeBlock: () => editor.isActive("codeBlock"),
  alignLeft: () => editor.isActive({ textAlign: "left" }),
  alignCenter: () => editor.isActive({ textAlign: "center" }),
  alignRight: () => editor.isActive({ textAlign: "right" }),
  link: () => editor.isActive("link"),
};

document.querySelectorAll("#toolbar .tb").forEach((b) => {
  b.type = "button";
  b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the editor selection
  b.addEventListener("click", () => { const fn = COMMANDS[b.dataset.cmd]; if (fn) fn(); });
});

$("block-type").addEventListener("change", (e) => {
  const v = e.target.value;
  if (v === "p") chain().setParagraph().run();
  else chain().setHeading({ level: Number(v) }).run();
});
$("text-color").addEventListener("input", (e) => chain().setColor(e.target.value).run());

function refreshToolbar() {
  document.querySelectorAll("#toolbar .tb").forEach((b) => {
    const fn = ACTIVE[b.dataset.cmd];
    b.classList.toggle("on", !!fn && fn());
  });
  let bt = "p";
  for (let l = 1; l <= 4; l++) if (editor.isActive("heading", { level: l })) bt = String(l);
  $("block-type").value = bt;
  $("table-tools").classList.toggle("show", editor.isActive("table"));
}

// ---------- slash menu ----------
const SLASH_ITEMS = [
  { label: "Heading 1", hint: "Big section title", run: () => chain().setHeading({ level: 1 }).run() },
  { label: "Heading 2", hint: "Section title", run: () => chain().setHeading({ level: 2 }).run() },
  { label: "Heading 3", hint: "Sub-section title", run: () => chain().setHeading({ level: 3 }).run() },
  { label: "Bullet list", hint: "Simple list", run: () => chain().toggleBulletList().run() },
  { label: "Numbered list", hint: "Ordered list", run: () => chain().toggleOrderedList().run() },
  { label: "Task list", hint: "Checklist", run: () => chain().toggleTaskList().run() },
  { label: "Quote", hint: "Highlight a quote", run: () => chain().toggleBlockquote().run() },
  { label: "Code block", hint: "Syntax-highlighted code", run: () => chain().toggleCodeBlock().run() },
  { label: "Divider", hint: "Horizontal line", run: () => chain().setHorizontalRule().run() },
  { label: "Image", hint: "Upload a picture", run: () => $("inline-file").click() },
  { label: "YouTube", hint: "Embed a video link", run: insertYoutube },
  { label: "Table", hint: "3 x 3 table", run: () => COMMANDS.table() },
];
let slashOpen = false;
let slashIndex = 0;
let slashMatches = [];
let slashRange = null;

function closeSlash() { slashOpen = false; $("slash").hidden = true; }

function renderSlash() {
  const box = $("slash");
  box.replaceChildren(...slashMatches.map((it, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === slashIndex ? "active" : "";
    b.append(document.createTextNode(it.label));
    const s = document.createElement("small");
    s.textContent = it.hint;
    b.appendChild(s);
    b.addEventListener("mousedown", (e) => { e.preventDefault(); runSlash(i); });
    return b;
  }));
}

function updateSlash() {
  const { $from, empty } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.name === "codeBlock") return closeSlash();
  const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
  const m = before.match(/^\/([a-z0-9 ]*)$/i);
  if (!m) return closeSlash();
  const q = m[1].toLowerCase();
  slashMatches = SLASH_ITEMS.filter((it) => it.label.toLowerCase().includes(q));
  if (!slashMatches.length) return closeSlash();
  slashRange = { from: $from.pos - before.length, to: $from.pos };
  if (!slashOpen) slashIndex = 0;
  slashIndex = Math.min(slashIndex, slashMatches.length - 1);
  slashOpen = true;
  const c = editor.view.coordsAtPos($from.pos);
  const box = $("slash");
  box.hidden = false;
  box.style.left = Math.min(c.left, window.innerWidth - 280) + "px";
  box.style.top = Math.min(c.bottom + 6, window.innerHeight - 320) + "px";
  renderSlash();
}

function runSlash(i) {
  const it = slashMatches[i];
  if (!it) return;
  const range = slashRange;
  closeSlash();
  editor.chain().focus().deleteRange(range).run();
  it.run();
}

editor.view.dom.addEventListener("keydown", (e) => {
  if (!slashOpen) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); e.stopImmediatePropagation();
    slashIndex = (slashIndex + (e.key === "ArrowDown" ? 1 : -1) + slashMatches.length) % slashMatches.length;
    renderSlash();
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault(); e.stopImmediatePropagation();
    runSlash(slashIndex);
  } else if (e.key === "Escape") {
    e.preventDefault(); e.stopImmediatePropagation();
    closeSlash();
  }
}, true);
editor.view.dom.addEventListener("blur", () => setTimeout(closeSlash, 150));

// ---------- images: toolbar picker, paste and drop ----------
$("inline-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) pickAndInsertImage(f);
});
editor.view.dom.addEventListener("paste", (e) => {
  const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.startsWith("image/"));
  if (f) { e.preventDefault(); pickAndInsertImage(f); }
});
editor.view.dom.addEventListener("drop", (e) => {
  const f = [...(e.dataTransfer ? e.dataTransfer.files : [])].find((x) => x.type.startsWith("image/"));
  if (f) { e.preventDefault(); pickAndInsertImage(f); }
});

// ---------- cover photo ----------
function renderCover() {
  const has = !!(cover && cover.url);
  $("cover-img").hidden = !has;
  $("cover-empty").hidden = has;
  $("cover-actions").hidden = !has;
  if (has) {
    $("cover-img").src = cld(cover.url, "f_auto,q_auto,w_1200");
    $("cover-alt").value = cover.alt || "";
  }
}
async function uploadCover(file) {
  const bar = $("cover-progress");
  try {
    bar.hidden = false;
    bar.firstElementChild.style.width = "0";
    const url = await uploadImage(file, (p) => { bar.firstElementChild.style.width = Math.round(p * 100) + "%"; });
    cover = { url, alt: (cover && cover.alt) || "" };
    renderCover();
    markDirty();
  } catch (e) { toast(e.message, true); }
  finally { bar.hidden = true; }
}
const coverBox = $("cover-box");
coverBox.addEventListener("click", () => { if (!cover) $("cover-file").click(); });
coverBox.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !cover) { e.preventDefault(); $("cover-file").click(); } });
coverBox.addEventListener("dragover", (e) => { e.preventDefault(); coverBox.classList.add("drag"); });
coverBox.addEventListener("dragleave", () => coverBox.classList.remove("drag"));
coverBox.addEventListener("drop", (e) => {
  e.preventDefault();
  coverBox.classList.remove("drag");
  const f = e.dataTransfer.files[0];
  if (f) uploadCover(f);
});
$("cover-file").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) uploadCover(f); });
$("cover-replace").addEventListener("click", () => $("cover-file").click());
$("cover-remove").addEventListener("click", () => { cover = null; renderCover(); markDirty(); });
$("cover-alt").addEventListener("input", (e) => { if (cover) { cover.alt = e.target.value; markDirty(); } });

// ---------- form fields ----------
$("title").addEventListener("input", () => {
  if (!slugTouched && !(existing && existing.status === "published")) $("slug").value = slugify($("title").value);
  updateSlugHint();
  markDirty();
});
$("slug").addEventListener("input", () => { slugTouched = true; updateSlugHint(); markDirty(); });
$("slug").addEventListener("blur", () => { $("slug").value = slugify($("slug").value); updateSlugHint(); });
["excerpt", "tags", "pubdate", "seo-title", "seo-desc"].forEach((id) => $(id).addEventListener("input", markDirty));
function updateSlugHint() { $("slug-hint").textContent = "/blog/" + (slugify($("slug").value) || "your-slug"); }

function toLocalInput(ms) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function applyStatusUI() {
  const pub = !!existing && existing.status === "published";
  $("btn-draft").hidden = pub;
  $("btn-unpublish").hidden = !pub;
  $("btn-publish").textContent = pub ? "Update" : "Publish";
  $("status-line").textContent = existing
    ? "Status: " + (pub ? "published" : "draft") + (existing.updatedAt ? " · last saved " + fmtDate(toMillis(existing.updatedAt)) : "")
    : "Status: new draft (not saved yet)";
}

// ---------- load ----------
async function load() {
  if (!postId) { applyStatusUI(); updateSlugHint(); updateCounts(); return; }
  try {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists()) { alert("That post does not exist."); location.replace("/admin"); return; }
    existing = snap.data();
    $("title").value = existing.title || "";
    $("slug").value = existing.slug || "";
    slugTouched = true;
    $("excerpt").value = existing.excerpt || "";
    $("tags").value = (existing.tags || []).join(", ");
    $("seo-title").value = (existing.seo && existing.seo.metaTitle) || "";
    $("seo-desc").value = (existing.seo && existing.seo.metaDescription) || "";
    if (existing.publishedAt) $("pubdate").value = toLocalInput(toMillis(existing.publishedAt));
    cover = existing.coverImage && existing.coverImage.url ? { url: existing.coverImage.url, alt: existing.coverImage.alt || "" } : null;
    let content = existing.contentHtml || "";
    if (existing.contentJson) { try { content = JSON.parse(existing.contentJson); } catch (e) { /* fall back to html */ } }
    editor.commands.setContent(content, false);
    renderCover(); updateSlugHint(); updateCounts(); applyStatusUI();
    dirty = false;
    setState("Loaded");
  } catch (e) {
    console.error(e);
    toast("Could not load the post: " + (e.code || e.message), true);
  }
}

// ---------- save ----------
function formData() {
  const html = sanitizeHtml(editor.getHTML());
  return {
    title: $("title").value.trim(),
    slug: slugify($("slug").value) || slugify($("title").value),
    excerpt: $("excerpt").value.trim(),
    tags: parseTags($("tags").value),
    html,
    json: JSON.stringify(editor.getJSON()),
    readingTime: readingTimeMinutes(editor.getText()),
    seo: { metaTitle: $("seo-title").value.trim(), metaDescription: $("seo-desc").value.trim() },
  };
}

async function save(targetStatus, silent) {
  if (saving) return false;
  const f = formData();
  if (!f.title) { if (!silent) toast("Please add a title.", true); return false; }
  if (!f.slug) { if (!silent) toast("Please add a URL slug.", true); return false; }
  const empty = editor.isEmpty;
  if (targetStatus === "published") {
    if (empty) { toast("Write something before publishing.", true); return false; }
    if (cover && !cover.alt.trim() && !confirm("The cover photo has no alt text. Publish anyway?")) return false;
  }
  saving = true;
  setState("Saving...");
  ["btn-draft", "btn-publish", "btn-unpublish"].forEach((id) => { $(id).disabled = true; });
  try {
    const slugRef = doc(db, "slugs", f.slug);
    const slugSnap = await getDoc(slugRef);
    const ref = postId ? doc(db, "posts", postId) : doc(collection(db, "posts"));
    if (slugSnap.exists() && slugSnap.data().postId !== ref.id) {
      throw Object.assign(new Error('The slug "' + f.slug + '" is already used by another post. Choose a different one.'), { user: true });
    }
    const data = {
      title: f.title,
      slug: f.slug,
      excerpt: f.excerpt,
      tags: f.tags,
      contentJson: f.json,
      contentHtml: f.html,
      coverImage: cover && cover.url ? { url: cover.url, alt: cover.alt || "" } : null,
      readingTime: f.readingTime,
      seo: f.seo,
      status: targetStatus,
      updatedAt: serverTimestamp(),
    };
    const picked = $("pubdate").value;
    if (picked) data.publishedAt = Timestamp.fromDate(new Date(picked));
    else if (targetStatus === "published" && !(existing && existing.publishedAt)) data.publishedAt = serverTimestamp();
    if (!existing) data.createdAt = serverTimestamp();

    const batch = writeBatch(db);
    batch.set(ref, data, { merge: true });
    batch.set(slugRef, { postId: ref.id });
    if (existing && existing.slug && existing.slug !== f.slug) batch.delete(doc(db, "slugs", existing.slug));
    await batch.commit();

    postId = ref.id;
    history.replaceState(null, "", "/admin/editor?id=" + encodeURIComponent(postId));
    existing = (await getDoc(ref)).data();
    if (existing.publishedAt && !picked) $("pubdate").value = toLocalInput(toMillis(existing.publishedAt));
    dirty = false;
    setState("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    applyStatusUI();
    if (!silent) toast(targetStatus === "published" ? "Published. It is live on /blog." : "Draft saved.");
    return true;
  } catch (e) {
    if (!e.user) console.error(e);
    setState("Save failed");
    toast(e.user ? e.message : "Could not save: " + (e.code || e.message), true);
    return false;
  } finally {
    saving = false;
    ["btn-draft", "btn-publish", "btn-unpublish"].forEach((id) => { $(id).disabled = false; });
  }
}

$("btn-draft").addEventListener("click", () => save("draft"));
$("btn-publish").addEventListener("click", () => save("published"));
$("btn-unpublish").addEventListener("click", () => {
  if (confirm("Unpublish this post? It will disappear from the public blog.")) save("draft");
});

// Autosave drafts only (never silently changes a published post).
setInterval(() => {
  if (dirty && !saving && (!existing || existing.status !== "published")) save("draft", true);
}, 20000);
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save(existing && existing.status === "published" ? "published" : "draft");
  }
});

// ---------- preview ----------
$("btn-preview").addEventListener("click", () => {
  const f = formData();
  $("pv-title").textContent = f.title || "Untitled";
  $("pv-meta").textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " · " + f.readingTime + " min read";
  $("pv-tags").replaceChildren(...f.tags.map((t) => { const s = document.createElement("span"); s.className = "stack-tag"; s.textContent = t; return s; }));
  $("pv-cover").hidden = !(cover && cover.url);
  if (cover && cover.url) { $("pv-cover-img").src = cld(cover.url, "f_auto,q_auto,w_1400"); $("pv-cover-img").alt = cover.alt || ""; }
  $("pv-body").innerHTML = f.html;
  $("preview").hidden = false;
  document.body.style.overflow = "hidden";
});
$("preview-close").addEventListener("click", () => { $("preview").hidden = true; document.body.style.overflow = ""; });

await load();
