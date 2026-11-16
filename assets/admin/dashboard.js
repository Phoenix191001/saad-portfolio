import { db } from "/assets/firebase-config.js";
import { requireAdmin, logout } from "/assets/admin/guard.js";
import { toMillis, fmtDate, cld } from "/assets/admin/common.js";
import {
  collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
$("who").textContent = user.email;
$("logout").addEventListener("click", logout);

let posts = [];

function toast(msg, isError) {
  const t = document.createElement("div");
  t.className = "toast" + (isError ? " error" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

async function load() {
  try {
    const snap = await getDocs(collection(db, "posts"));
    posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    posts.sort((a, b) => (toMillis(b.updatedAt) || toMillis(b.createdAt)) - (toMillis(a.updatedAt) || toMillis(a.createdAt)));
    render();
  } catch (e) {
    console.error(e);
    $("list").innerHTML = "";
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "Could not load posts: " + (e.code || e.message);
    $("list").appendChild(d);
  }
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-sm " + (cls || "");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function row(p) {
  const el = document.createElement("div");
  el.className = "post-row";

  const thumb = document.createElement(p.coverImage && p.coverImage.url ? "img" : "div");
  thumb.className = "thumb";
  if (thumb.tagName === "IMG") { thumb.src = cld(p.coverImage.url, "f_auto,q_auto,w_160,h_100,c_fill"); thumb.alt = ""; }
  el.appendChild(thumb);

  const info = document.createElement("div");
  const h = document.createElement("h3");
  const badge = document.createElement("span");
  badge.className = "badge " + (p.status === "published" ? "published" : "draft");
  badge.textContent = p.status === "published" ? "Published" : "Draft";
  h.append(badge, document.createTextNode(p.title || "Untitled"));
  const sub = document.createElement("div");
  sub.className = "sub";
  const when = p.status === "published" ? "published " + fmtDate(toMillis(p.publishedAt)) : "edited " + fmtDate(toMillis(p.updatedAt));
  sub.textContent = [when, "/blog/" + p.slug, (p.tags || []).join(", ")].filter(Boolean).join(" · ");
  info.append(h, sub);
  el.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const edit = document.createElement("a");
  edit.className = "btn-sm";
  edit.href = "/admin/editor?id=" + encodeURIComponent(p.id);
  edit.textContent = "Edit";
  actions.appendChild(edit);
  if (p.status === "published") {
    const view = document.createElement("a");
    view.className = "btn-sm";
    view.href = "/blog/" + encodeURIComponent(p.slug);
    view.target = "_blank";
    view.rel = "noopener";
    view.textContent = "View";
    actions.appendChild(view);
  }
  actions.appendChild(button(p.status === "published" ? "Unpublish" : "Publish", "", () => togglePublish(p)));
  actions.appendChild(button("Delete", "danger", () => remove(p)));
  el.appendChild(actions);
  return el;
}

function render() {
  $("n-all").textContent = posts.length;
  $("n-pub").textContent = posts.filter((p) => p.status === "published").length;
  $("n-draft").textContent = posts.filter((p) => p.status !== "published").length;
  const q = $("q").value.trim().toLowerCase();
  const f = $("f").value;
  const list = posts.filter((p) => {
    if (f && (p.status === "published" ? "published" : "draft") !== f) return false;
    return !q || ((p.title || "") + " " + (p.slug || "") + " " + (p.tags || []).join(" ")).toLowerCase().includes(q);
  });
  if (!list.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = posts.length ? "No posts match." : "No posts yet. Click \"+ New post\" to write your first one.";
    $("list").replaceChildren(d);
  } else $("list").replaceChildren(...list.map(row));
}

async function togglePublish(p) {
  const publishing = p.status !== "published";
  try {
    const patch = { status: publishing ? "published" : "draft", updatedAt: serverTimestamp() };
    if (publishing && !p.publishedAt) patch.publishedAt = serverTimestamp();
    await updateDoc(doc(db, "posts", p.id), patch);
    toast(publishing ? "Published." : "Moved to drafts.");
    await load();
  } catch (e) {
    console.error(e);
    toast("Could not update: " + (e.code || e.message), true);
  }
}

async function remove(p) {
  if (!confirm('Delete "' + (p.title || "Untitled") + '"? This cannot be undone.')) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "posts", p.id));
    if (p.slug) batch.delete(doc(db, "slugs", p.slug));
    await batch.commit();
    toast("Post deleted.");
    await load();
  } catch (e) {
    console.error(e);
    toast("Could not delete: " + (e.code || e.message), true);
  }
}

$("q").addEventListener("input", render);
$("f").addEventListener("change", render);
await load();
