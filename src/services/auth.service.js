import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase.config.js";

const provider = new GoogleAuthProvider();

const setRemember = async (remember) => {
  return await setPersistence(
    auth,
    remember
      ? browserLocalPersistence
      : browserSessionPersistence
  );
};

/* ================= LOGIN ================= */
export const login = async (email, password, remember) => {
  try {
    await setRemember(remember);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

/* ================= REGISTER ================= */
export const register = async (email, password, remember) => {
  const cleanEmail = email.trim().toLowerCase();

  // 1. KIỂM TRA QUYỀN TRƯỚC KHI TẠO TÀI KHOẢN
  let role = "user";
  
  if (cleanEmail === "tranvominhluan8@gmail.com") {
    role = "admin";
  } else {
    try {
      const staffQuery = query(collection(db, "staff"), where("email", "==", cleanEmail));
      const querySnapshot = await getDocs(staffQuery);

      if (!querySnapshot.empty) {
        const staffData = querySnapshot.docs[0].data();
        
        if (staffData.role === "cashier" || staffData.role === "receptionist") {
          role = "cashier"; 
        } else {
          role = staffData.role;
        }
      } else {
        throw new Error("Email của bạn không tồn tại trong danh sách nhân sự hệ thống!");
      }
    } catch (error) {
      throw error;
    }
  }

  // 2. TIẾN HÀNH TẠO AUTH VÀ FIRESTORE USERS
  try {
    await setRemember(remember);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email.toLowerCase(),
      name: "",
      phone: "",
      avatar: "",
      address: "",
      birthday: "",
      gender: "",

      role: role, 
      loyaltyPoints: 0,
      membershipLevel: "Bronze",

      createdAt: serverTimestamp()
    });

    return { user, role };
  } catch (error) {
    console.error("LỖI KHỞI TẠO TÀI KHOẢN VIA FIREBASE:", error);
    throw error;
  }
};

/* ================= GOOGLE ================= */
export const loginWithGoogle = async (remember) => {
  try {
    await setRemember(remember);
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    let role = "user";
    if (!snap.exists()) {
      const cleanEmail = user.email.trim().toLowerCase();
      
      if (cleanEmail === "tranvominhluan8@gmail.com") {
        role = "admin";
      } else {
        const staffQuery = query(collection(db, "staff"), where("email", "==", cleanEmail));
        const querySnapshot = await getDocs(staffQuery);

        if (!querySnapshot.empty) {
          const staffData = querySnapshot.docs[0].data();
          if (staffData.role === "cashier" || staffData.role === "receptionist") {
            role = "cashier";
          } else {
            role = staffData.role;
          }
        } else {
          await user.delete();
          throw new Error("Tài khoản Google này không có quyền truy cập hệ thống nhân sự!");
        }
      }

      await setDoc(ref, {
        uid: user.uid,
        email: user.email.toLowerCase(),
        name: user.displayName || "",
        phone: "",
        avatar: user.photoURL || "",
        address: "",
        birthday: "",
        gender: "",
        role: role,
        loyaltyPoints: 0,
        membershipLevel: "Bronze",
        createdAt: serverTimestamp()
      });
    } else {
      role = snap.data().role || "user";
    }
    return { user, role };
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
};