import { auth } from "/assets/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Only these accounts count as admin. The Firestore rules enforce the same list.
export const ADMIN_UIDS = ["F0LV84dMYBeWKeeLHXiHltSNW122"];

export const isAdmin = (user) => !!user && ADMIN_UIDS.includes(user.uid);

// Use on every admin page: resolves with the admin user, otherwise sends you to the login page.
export function requireAdmin() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, async (user) => {
      off();
      if (isAdmin(user)) return resolve(user);
      if (user) await signOut(auth);
      location.replace("/admin/login");
    });
  });
}

export async function logout() {
  await signOut(auth);
  location.replace("/admin/login");
}
