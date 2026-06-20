import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // ✅ THÊM

const firebaseConfig = {
  apiKey: "AIzaSyDNP2i2PuWvFFUU8zsvd0EG-66kf12FU3I",
  authDomain: "highlands-c9b25.firebaseapp.com",
  projectId: "highlands-c9b25",
  storageBucket: "highlands-c9b25.firebasestorage.app",
  messagingSenderId: "517843498604",
  appId: "1:517843498604:web:7ff4f68762f599ffa70a49"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app); // ✅ THÊM