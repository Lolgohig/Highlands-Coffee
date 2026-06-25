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
   DOM ELEMENTS
======================================================= */
const megaMenu = document.getElementById("megaMenu");
const categoriesMenuContainer = document.getElementById("categoriesMenuContainer");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* =======================================================
   DROPDOWN AVATAR LOGIC
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
   LOAD USER AVATAR
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
      console.error("Lỗi đăng xuất:", err);
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
   HÀM PHÂN LOẠI MÀU SẮC VÀ THỨ TỰ THEO TÊN DANH MỤC
======================================================= */
function getCategoryMeta(categoryName) {
  const name = (categoryName || "").toLowerCase().trim();

  // 1. Nhóm các sản phẩm Cà phê
  if (name.includes("cà phê") || name.includes("coffee") || name.includes("phin")) {
    return { cssClass: "cat-ca-phe", orderWeight: 1 };
  }
  // 2. Nhóm các sản phẩm Trà
  if (name.includes("trà") || name.includes("tea")) {
    return { cssClass: "cat-tra", orderWeight: 2 };
  }
  // 3. Nhóm các sản phẩm Freeze đá xay
  if (name.includes("freeze")) {
    return { cssClass: "cat-freeze", orderWeight: 3 };
  }
  // 4. Các danh mục còn lại (Bánh ngọt, bánh mì, merch...)
  return { cssClass: "cat-khac", orderWeight: 4 };
}

/* =======================================================
   LOAD MENU CATEGORIES PAGE (Bố cục chuẩn chỉ chính chủ)
======================================================= */
async function loadMenuCategoriesPage() {
  if (!categoriesMenuContainer) return;
  categoriesMenuContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">Đang sắp xếp danh mục thực đơn...</div>`;

  try {
    const querySnapshot = await getDocs(collection(db, "categories"));
    const categoriesList = [];

    // Bước 1: Nạp toàn bộ danh mục từ Firestore vào mảng tạm thời
    querySnapshot.forEach((categoryDoc) => {
      const data = categoryDoc.data();
      const meta = getCategoryMeta(data.name);

      categoriesList.push({
        id: categoryDoc.id,
        name: data.name || "Tên danh mục",
        description: data.description || "Mô tả sản phẩm đang được cập nhật.",
        image: data.image || "https://placehold.co/600x450?text=Highlands+Coffee",
        cssClass: meta.cssClass,
        orderWeight: meta.orderWeight
      });
    });

    // Bước 2: Tiến hành sắp xếp danh mục theo đúng thứ tự phân hạng (Cà phê -> Trà -> Freeze -> Khác)
    categoriesList.sort((a, b) => a.orderWeight - b.orderWeight);

    // Bước 3: Làm sạch vùng chứa và kết xuất cấu trúc HTML ra giao diện
    categoriesMenuContainer.innerHTML = "";

    categoriesList.forEach((cat) => {
      const row = document.createElement("div");
      row.className = `category-row ${cat.cssClass}`;

      row.innerHTML = `
        <div class="category-image-block">
          <a href="catalog.html?category=${cat.id}">
            <img src="${cat.image}" alt="${cat.name}">
          </a>
        </div>
        
        <div class="category-content-block">
          <h2 class="category-title">
            <a href="catalog.html?category=${cat.id}">
              ${cat.name}
            </a>
          </h2>
          <p class="category-description">
            ${cat.description}
          </p>
        </div>
      `;

      categoriesMenuContainer.appendChild(row);
    });

  } catch (err) {
    console.error("Lỗi khi kết xuất danh mục trang menu thực đơn:", err);
    categoriesMenuContainer.innerHTML = `<div style="text-align:center; padding:40px; color:red;">Không thể nạp dữ liệu menu vào lúc này!</div>`;
  }
}

/* =======================================================
   INITIALIZE RUNNING APPLICATION
======================================================= */
loadMegaMenu();
loadMenuCategoriesPage();