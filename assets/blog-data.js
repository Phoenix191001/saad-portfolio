import { db } from "/assets/firebase-config.js";
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { toMillis } from "/assets/admin/common.js";

export const SITE = "https://saad-portfolio-saad-4985.vercel.app";

// No composite index needed: one equality filter, sorted in the browser.
export async function fetchPublished() {
  const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "published")));
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  posts.sort((a, b) => toMillis(b.publishedAt) - toMillis(a.publishedAt));
  return posts;
}

export async function fetchBySlug(slug) {
  const snap = await getDocs(
    query(collection(db, "posts"), where("slug", "==", slug), where("status", "==", "published"), limit(1))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}
