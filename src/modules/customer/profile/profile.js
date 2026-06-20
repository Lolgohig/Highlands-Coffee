import {
  auth,
  db
} from "../../../services/firebase.config.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  CLOUDINARY_API
} from "../../../services/cloudinary.config.js";

/* ================= DOM ================= */

const profileForm = document.getElementById("profileForm");
const avatarPreview = document.getElementById("avatarPreview");
const avatarInput = document.getElementById("avatarInput");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const birthdayInput = document.getElementById("birthday");
const genderInput = document.getElementById("gender");
const addressInput = document.getElementById("address");
const roleInput = document.getElementById("role");
const membershipInput = document.getElementById("membershipLevel");
const loyaltyInput = document.getElementById("loyaltyPoints");

// DOM Các thành phần Membership mới nâng cấp
const currentRankText = document.getElementById("currentRankText");
const currentPointsText = document.getElementById("currentPointsText");
const progressBar = document.getElementById("progressBar");
const nextRankHint = document.getElementById("nextRankHint");
const upgradeRankBtn = document.getElementById("upgradeRankBtn");

let currentUser = null;
let currentDbPoints = 0;
let currentDbLevel = "Bronze";

/* ================= RANK CONFIGURATION ================= */
const RANK_THRESHOLDS = [
  { name: "Bronze", min: 0 },
  { name: "Iron", min: 1000 },
  { name: "Gold", min: 3000 },
  { name: "Diamond", min: 6000 },
  { name: "Platinum", min: 10000 }
];

/* ================= SYSTEM LOGIC CALCULATE ================= */
function updateMembershipUI(points, currentLevelInDatabase) {
  currentPointsText.textContent = points.toLocaleString();
  currentRankText.textContent = currentLevelInDatabase;

  // Xác định rank thực tế tương ứng dựa theo điểm số hiện tại
  let calculatedRank = "Bronze";
  let nextRank = null;

  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (points >= RANK_THRESHOLDS[i].min) {
      calculatedRank = RANK_THRESHOLDS[i].name;
      nextRank = RANK_THRESHOLDS[i + 1] || null;
    }
  }

  // Cập nhật thanh tiến trình Progress Bar
  let percent = 0;
  if (nextRank) {
    const currentThreshold = RANK_THRESHOLDS.find(r => r.name === calculatedRank).min;
    const totalSegment = nextRank.min - currentThreshold;
    const earnedInSegment = points - currentThreshold;
    percent = (earnedInSegment / totalSegment) * 100;
    
    const pointsNeeded = nextRank.min - points;
    nextRankHint.innerHTML = `Bạn cần thêm <strong>${pointsNeeded.toLocaleString()} điểm</strong> để bứt phá lên hạng <strong>${nextRank.name}</strong>`;
  } else {
    percent = 100; // Đã đạt đỉnh Platinum
    nextRankHint.textContent = "🎉 Chúc mừng! Bạn đã đạt cấp bậc tối cao Platinum Hội Viên!";
  }
  progressBar.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;

  // Kiểm tra điều kiện mở khóa nút bấm Nâng Hạng:
  // Nếu rank tính toán thực tế cao hơn giá trị rank đang lưu ở Database -> Cho phép bấm
  if (calculatedRank !== currentLevelInDatabase) {
    upgradeRankBtn.disabled = false;
    upgradeRankBtn.dataset.targetRank = calculatedRank;
  } else {
    upgradeRankBtn.disabled = true;
    delete upgradeRankBtn.dataset.targetRank;
  }
}

/* ================= LOAD USER ================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  avatarPreview.src = data.avatar || "https://i.pravatar.cc/200";
  nameInput.value = data.name || "";
  emailInput.value = data.email || "";
  phoneInput.value = data.phone || "";
  birthdayInput.value = data.birthday || "";
  genderInput.value = data.gender || "";
  addressInput.value = data.address || "";
  roleInput.value = data.role || "";
  
  // Đồng bộ trạng thái vào các biến toàn cục
  currentDbLevel = data.membershipLevel || "Bronze";
  currentDbPoints = data.loyaltyPoints || 0;

  membershipInput.value = currentDbLevel;
  loyaltyInput.value = currentDbPoints;

  // Gọi hàm vẽ lại cấu trúc Membership UI trực quan
  updateMembershipUI(currentDbPoints, currentDbLevel);
});

/* ================= EVENT UPGRADE RANK ================= */
upgradeRankBtn.onclick = async () => {
  const targetRank = upgradeRankBtn.dataset.targetRank;
  if (!targetRank || !currentUser) return;

  try {
    upgradeRankBtn.disabled = true;
    upgradeRankBtn.textContent = "Đang xử lý...";

    await updateDoc(doc(db, "users", currentUser.uid), {
      membershipLevel: targetRank
    });

    alert(`🎉 Tuyệt vời! Bạn đã được nâng cấp tài khoản lên hạng thương gia: ${targetRank}`);
    
    // Cập nhật lại giá trị hiển thị nội bộ lập tức
    currentDbLevel = targetRank;
    membershipInput.value = targetRank;
    updateMembershipUI(currentDbPoints, targetRank);
    
    upgradeRankBtn.textContent = "Yêu Cầu Lên Hạng";
  } catch (err) {
    console.error(err);
    alert("Đã xảy ra lỗi trong quá trình xử lý thăng hạng: " + err.message);
    upgradeRankBtn.disabled = false;
    upgradeRankBtn.textContent = "Yêu Cầu Lên Hạng";
  }
};

/* ================= CLOUDINARY ================= */

async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_API.uploadPreset);

  const response = await fetch(CLOUDINARY_API.uploadUrl, {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  return data.secure_url;
}

/* ================= SAVE PROFILE ================= */

profileForm.onsubmit = async (e) => {
  e.preventDefault();

  try {
    let avatarUrl = avatarPreview.src;

    if (avatarInput.files[0]) {
      avatarUrl = await uploadAvatar(avatarInput.files[0]);
    }

    await updateDoc(doc(db, "users", currentUser.uid), {
      avatar: avatarUrl,
      name: nameInput.value,
      phone: phoneInput.value,
      birthday: birthdayInput.value,
      gender: genderInput.value,
      address: addressInput.value
    });

    alert("Cập nhật profile thành công!");
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};