import {
  db,
  auth
} from "../../../services/firebase.config.js";

import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* =======================================================
   DOM SELECTORS (Đồng bộ chính xác từ index.js)
======================================================= */

const megaMenu =
  document.getElementById("megaMenu");

const navbarAvatar =
  document.getElementById("navbarAvatar");

const dropdownMenu =
  document.getElementById("dropdownMenu");

const logoutBtn =
  document.getElementById("logoutBtn");

/* =======================================================
   DROPDOWN PROFILE
======================================================= */

if (navbarAvatar && dropdownMenu) {

  navbarAvatar.onclick = () => {
    dropdownMenu.classList.toggle("show");
  };

  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown")) {
      dropdownMenu.classList.remove("show");
    }
  };
}

/* =======================================================
   LOAD AVATAR USER
======================================================= */

onAuthStateChanged(auth, async (user) => {

  // BƯỚC 1: Nếu chưa đăng nhập, đá ngay về auth.html
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  try {

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    // BƯỚC 2: Nếu không tồn tại thông tin tài khoản, đá về auth.html
    if (!snap.exists()) {
      window.location.href = "auth.html";
      return;
    }

    const data = snap.data();

    // BƯỚC 3: Nếu đăng nhập rồi nhưng role KHÔNG PHẢI là "user", đá về auth.html
    if (data.role !== "user") {
      window.location.href = "auth.html";
      return;
    }

    // BƯỚC 4: Nếu thỏa mãn là "user" hợp lệ, giữ nguyên giao diện và hiển thị ảnh đại diện
    if (navbarAvatar) {
      navbarAvatar.src =
        data.avatar ||
        "https://i.pravatar.cc/150";
    }

  } catch (err) {

    console.error("Lỗi hệ thống kiểm tra phân quyền:", err);
    window.location.href = "auth.html";
  }
});

/* =======================================================
   LOGOUT SYSTEM
======================================================= */

if (logoutBtn) {

  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      window.location.href = "auth.html";
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };
}

/* =======================================================
   LOAD MEGA MENU (PHIÊN BẢN CHUẨN ĐỒNG BỘ CHO MỌI TRANG USER)
======================================================= */
async function loadMegaMenu() {
  const megaMenu = document.getElementById("megaMenu");
  if (!megaMenu) return;
  megaMenu.innerHTML = "";

  // Hàm cục bộ định cấu trúc trọng số thứ tự hiển thị Categories
  function getCategoryWeight(categoryName) {
    const name = (categoryName || "").toLowerCase().trim();
    if (name.includes("cà phê") || name.includes("coffee") || name.includes("phin")) return 1;
    if (name.includes("trà") || name.includes("tea")) return 2;
    if (name.includes("freeze")) return 3;
    return 4; // Bánh mì, bánh ngọt, merch, món khác...
  }

  try {
    const categorySnapshot = await getDocs(collection(db, "categories"));
    const categoriesList = [];

    // 1. Đọc dữ liệu thô từ Firestore vào mảng tạm
    categorySnapshot.forEach((categoryDoc) => {
      const categoryData = categoryDoc.data();
      categoriesList.push({
        id: categoryDoc.id,
        name: categoryData.name || "Tên danh mục",
        subCategories: categoryData.subCategories || [],
        orderWeight: getCategoryWeight(categoryData.name)
      });
    });

    // 2. Sắp xếp danh mục chính theo thứ tự chuẩn Highlands Coffee
    categoriesList.sort((a, b) => a.orderWeight - b.orderWeight);

    // 3. Tiến hành xây dựng cấu trúc HTML và sắp xếp danh mục con
    categoriesList.forEach((category) => {
      const column = document.createElement("div");
      column.className = "mega-column";

      column.innerHTML = `
        <h4>
          <a href="catalog.html?category=${category.id}">
            ${category.name}
          </a>
        </h4>
      `;

      // Copy mảng danh mục con để xử lý sắp xếp theo thời gian khởi tạo (createdAt)
      let subCategoriesArray = [...category.subCategories];
      if (subCategoriesArray.length > 0) {
        subCategoriesArray.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return timeA - timeB; // Cũ tạo trước đứng trước, mới tạo sau đứng sau
        });
      }

      // Vòng lặp kết xuất các đường link danh mục con (tối đa 6 món)
      let subCount = 0;
      subCategoriesArray.forEach((subCat) => {
        if (subCount < 6) {
          const link = document.createElement("a");
          link.className = "mega-sub-category";
          link.href = `catalog.html?subcategory=${subCat.id}`;
          link.textContent = subCat.name;

          column.appendChild(link);
          subCount++;
        }
      });

      megaMenu.appendChild(column);
    });
  } catch (err) {
    console.error("Lỗi đồng bộ cấu trúc Mega Menu hệ thống:", err);
  }
}
/* =======================================================
   SCROLL INTERACTION (Hiệu ứng cuộn trang của phần thân tĩnh)
======================================================= */

function initScrollAnimation() {
  const animatedCards = document.querySelectorAll(".info-card-box");
  
  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      }
    });
  }, { threshold: 0.15 });

  animatedCards.forEach(card => scrollObserver.observe(card));
}

/* =======================================================
   INIT RUNNING
======================================================= */

loadMegaMenu();
initScrollAnimation();