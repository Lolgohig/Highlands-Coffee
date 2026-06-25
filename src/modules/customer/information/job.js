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
   DOM SELECTORS (Đồng bộ chính xác cho trang Nghề nghiệp)
======================================================= */

const megaMenu = document.getElementById("megaMenu");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* =======================================================
   INIT RUNNING (Chỉ giữ lại sự kiện click giao diện tĩnh)
======================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initDropdownProfile();
    initLogoutSystem();
});

/* =======================================================
   DROPDOWN PROFILE
======================================================= */

function initDropdownProfile() {
  if (navbarAvatar && dropdownMenu) {
    navbarAvatar.onclick = (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    };

    window.onclick = (e) => {
      if (!e.target.closest(".profile-dropdown")) {
        dropdownMenu.classList.remove("show");
      }
    };
  }
}

/* =======================================================
   LOAD AVATAR USER & AUTH GUARD (Đã bọc luồng chạy an toàn)
======================================================= */

onAuthStateChanged(auth, async (user) => {
  // 1. Nếu không có trạng thái đăng nhập, đẩy về auth.html
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    
    // Nếu có tài khoản auth nhưng không có bản ghi trong Firestore
    if (!snap.exists()) {
      window.location.href = "auth.html";
      return;
    }

    const data = snap.data();

    // 2. PHÂN QUYỀN TRUY CẬP: Chỉ cho phép tài khoản có vai trò "user"
    if (data.role !== "user") {
      window.location.href = "auth.html";
      return;
    }

    // 3. HIỂN THỊ THÔNG TIN AVATAR KHI ĐÃ ĐẠT ĐỦ ĐIỀU KIỆN
    if (navbarAvatar) {
      navbarAvatar.src = data.avatar || "https://i.pravatar.cc/150";
    }

    // 4. KÍCH HOẠT HÀM ĐỌC DỮ LIỆU TẠI ĐÂY (Chỉ chạy khi mọi thứ đã an toàn)
    loadMegaMenu();
    initScrollReveal();

  } catch (err) {
    console.error("Lỗi khi tải dữ liệu xác thực & avatar người dùng:", err);
    // Nếu có lỗi bất đồng bộ xảy ra, cố gắng cứu vãn bằng cách vẫn cho tải giao diện thay vì đá đi
    loadMegaMenu();
    initScrollReveal();
  }
});

/* =======================================================
   LOGOUT SYSTEM
======================================================= */

function initLogoutSystem() {
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
}

/* =======================================================
   LOAD MEGA MENU (PHIÊN BẢN CHUẨN ĐỒNG BỘ CHO MỌI TRANG USER)
======================================================= */
async function loadMegaMenu() {
  const megaMenu = document.getElementById("megaMenu");
  if (!megaMenu) return;
  megaMenu.innerHTML = "";

  function getCategoryWeight(categoryName) {
    const name = (categoryName || "").toLowerCase().trim();
    if (name.includes("cà phê") || name.includes("coffee") || name.includes("phin")) return 1;
    if (name.includes("trà") || name.includes("tea")) return 2;
    if (name.includes("freeze")) return 3;
    return 4;
  }

  try {
    const categorySnapshot = await getDocs(collection(db, "categories"));
    const categoriesList = [];

    categorySnapshot.forEach((categoryDoc) => {
      const categoryData = categoryDoc.data();
      categoriesList.push({
        id: categoryDoc.id,
        name: categoryData.name || "Tên danh mục",
        subCategories: categoryData.subCategories || [],
        orderWeight: getCategoryWeight(categoryData.name)
      });
    });

    categoriesList.sort((a, b) => a.orderWeight - b.orderWeight);

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

      let subCategoriesArray = [...category.subCategories];
      if (subCategoriesArray.length > 0) {
        subCategoriesArray.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return timeA - timeB;
        });
      }

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
   SCROLL REVEAL INTERACTION
======================================================= */

function initScrollReveal() {
    const revealElements = document.querySelectorAll(".scroll-reveal");
    if (revealElements.length === 0) return;

    const checkReveal = () => {
        const triggerBottom = (window.innerHeight / 5) * 4.5;
        revealElements.forEach((element) => {
            const elementTop = element.getBoundingClientRect().top;
            if (elementTop < triggerBottom) {
                element.classList.add("active");
            }
        });
    };

    checkReveal();
    window.addEventListener("scroll", checkReveal);
}