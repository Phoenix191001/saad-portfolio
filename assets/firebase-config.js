import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFL6AG4t3qePQjsW4MaFgKrwDtF0iw8JM",
  authDomain: "saad-portf.firebaseapp.com",
  projectId: "saad-portf",
  storageBucket: "saad-portf.firebasestorage.app",
  messagingSenderId: "248207540967",
  appId: "1:248207540967:web:d66b31202a6c6127bfd842"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
