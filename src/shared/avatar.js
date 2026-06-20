import { auth, db } from "../services/firebase.config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!snap.exists()) return;

    const data = snap.data();

    const avatarUrl =
      data.avatar ||
      "https://i.pravatar.cc/150";

    /* ===== PROFILE PAGE ===== */

    const avatarPreview =
      document.getElementById("avatarPreview");

    if (avatarPreview) {
      avatarPreview.src = avatarUrl;
    }

    /* ===== NAVBAR ===== */

    const navbarAvatar =
      document.getElementById("navbarAvatar");

    if (navbarAvatar) {
      navbarAvatar.src = avatarUrl;
    }

  } catch (err) {
    console.error(err);
  }
});