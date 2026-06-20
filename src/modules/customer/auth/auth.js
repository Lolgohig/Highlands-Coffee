import { login, register, loginWithGoogle } from "../../../services/auth.service.js";
import { auth, db } from "../../../services/firebase.config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ================= CONFIG ================= */
const REMEMBER_KEY = "rememberUser";
let isWorking = false; 

/* ================= DOM ================= */
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const slider = document.getElementById("slider");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const mainTitle = document.getElementById("mainTitle");
const subTitle = document.getElementById("subTitle");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const confirmPassword = document.getElementById("confirmPassword");

const googleBtn = document.getElementById("googleBtn");

/* ================= TAB SWITCH ================= */
tabLogin.onclick = () => {
  slider.style.left = "0%";
  loginForm.classList.add("active");
  registerForm.classList.remove("active");
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  mainTitle.innerText = "Welcome Back";
  subTitle.innerText = "Please enter your details to access your account";
};

tabRegister.onclick = () => {
  slider.style.left = "50%";
  registerForm.classList.add("active");
  loginForm.classList.remove("active");
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  mainTitle.innerText = "Let's Get Started";
  subTitle.innerText = "Please enter your details to create your account";
};

/* ================= REDIRECT ================= */
function directRedirect(role) {
  if (role === "admin") {
    window.location.href = "admin-inventory.html";
  } else if (role === "cashier") {
    window.location.href = "staff.html"; 
  } else {
    window.location.href = "index.html";
  }
}

async function handleRedirect() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;
    const data = snap.data();
    directRedirect(data.role);
  } catch (err) {
    console.error(err);
  }
}

/* ================= HÀM BỔ TRỢ: DỊCH LỖI FIREBASE SANG TIẾNG VIỆT ================= */
function translateFirebaseError(errorCode) {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Định dạng địa chỉ Email không hợp lệ!";
    case "auth/user-disabled":
      return "Tài khoản này đã bị vô hiệu hóa khỏi hệ thống!";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Thông tin tài khoản hoặc mật khẩu không chính xác!";
    case "auth/email-already-in-use":
      return "Email này đã được đăng ký bởi một tài khoản khác!";
    case "auth/weak-password":
      return "Mật khẩu quá ngắn! Firebase yêu cầu mật khẩu phải từ 6 ký tự trở lên.";
    case "auth/operation-not-allowed":
      return "Hệ thống đang tạm khóa phương thức đăng nhập này.";
    default:
      return "Đã xảy ra sự cố kết nối hệ thống. Vui lòng thử lại sau!";
  }
}

/* ================= LOGIN ================= */
loginForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const emailVal = loginEmail.value.trim();
  const passwordVal = loginPassword.value;

  if (!emailVal || !passwordVal) {
    alert("Vui lòng điền đầy đủ Email và Mật khẩu!");
    return;
  }

  const remember = document.getElementById("rememberLogin").checked;
  isWorking = true;
  try {
    await login(emailVal, passwordVal, remember);
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    await handleRedirect();
  } catch (err) {
    alert(translateFirebaseError(err.code) || err.message);
  } finally {
    isWorking = false;
  }
};

/* ================= REGISTER (ĐÃ CHỈNH LẠI ĐIỀU KIỆN MẬT KHẨU) ================= */
registerForm.onsubmit = async (e) => {
  e.preventDefault();

  const emailVal = registerEmail.value.trim();
  const passwordVal = registerPassword.value;
  const confirmVal = confirmPassword.value;

  // 1. Kiểm tra định dạng Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailVal)) {
    alert("Lỗi: Địa chỉ Email không đúng định dạng quy chuẩn!");
    return;
  }

  // 2. CHỈ KIỂM TRA MẬT KHẨU CÓ CHỨA ÍT NHẤT 1 CHỮ SỐ (0-9)
  const numericRegex = /[0-9]/;
  if (!numericRegex.test(passwordVal)) {
    alert("Lỗi bảo mật: Mật khẩu bắt buộc phải chứa ít nhất một chữ số (từ 0 đến 9)!");
    return;
  }

  // 3. Kiểm tra mật khẩu lặp lại khớp nhau
  if (passwordVal !== confirmVal) {
    alert("Lỗi: Xác nhận mật khẩu nhập lại không khớp nhau!");
    return;
  }

  const remember = document.getElementById("rememberRegister").checked;
  isWorking = true; 

  try {
    const result = await register(emailVal, passwordVal, remember);
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    directRedirect(result.role);
  } catch (err) {
    alert(translateFirebaseError(err.code) || err.message);
  } finally {
    isWorking = false;
  }
};

/* ================= GOOGLE ================= */
if (googleBtn) {
  googleBtn.onclick = async () => {
    const remember = document.getElementById("rememberLogin").checked || document.getElementById("rememberRegister").checked;
    isWorking = true;
    try {
      const result = await loginWithGoogle(remember);
      localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
      directRedirect(result.role);
    } catch (err) {
      alert(translateFirebaseError(err.code) || err.message);
    } finally {
      isWorking = false;
    }
  };
}

/* ================= AUTO LOGIN ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (isWorking) return; 

  const remember = localStorage.getItem(REMEMBER_KEY);
  if (remember !== "true") return;
  await handleRedirect();
});