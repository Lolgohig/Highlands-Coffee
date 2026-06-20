import {
  db,
  auth
} from "../../../services/firebase.config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM ================= */
const totalProducts = document.getElementById("total-products");
const totalCategories = document.getElementById("total-categories");
const totalSubCategories = document.getElementById("total-sub-categories"); // DOM mới
const totalUsers = document.getElementById("total-users");
const totalOrders = document.getElementById("total-orders");
const recentProducts = document.getElementById("recent-products");

/* ================= NAVBAR ================= */
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* ================= DROPDOWN ================= */
if (avatarBtn && dropdownMenu) {
  avatarBtn.onclick = () => {
    dropdownMenu.classList.toggle("show");
  };

  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown")) {
      dropdownMenu.classList.remove("show");
    }
  };
}

/* ================= LOGOUT ================= */
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("rememberUser");
      window.location.href = "auth.html";
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };
}

/* ================= SAFE COUNT ================= */
async function getCollectionCount(collectionName) {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.size;
  } catch (err) {
    console.warn(`Không load được số lượng từ collection: ${collectionName}`, err.message);
    return 0;
  }
}

/* ================= SAFE SUB-CATEGORIES COUNT ================= */
async function getSubCategoriesCount() {
  try {
    // Thuật toán đếm tổng số lượng sub-categories nằm bên trong collection "sub_categories"
    const snapshot = await getDocs(collection(db, "sub_categories"));
    return snapshot.size;
  } catch (err) {
    // Phương án dự phòng nếu hệ thống lưu sub-categories lồng ghép trong tài liệu categories cũ
    try {
      const catSnapshot = await getDocs(collection(db, "categories"));
      let count = 0;
      catSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.subCategories && Array.isArray(data.subCategories)) {
          count += data.subCategories.length;
        }
      });
      return count;
    } catch (nestedErr) {
      console.warn("Không thể tính toán số lượng Sub-categories:", nestedErr.message);
      return 0;
    }
  }
}

/* ================= LOAD STATS ================= */
async function loadStats() {
  totalProducts.innerText = await getCollectionCount("products");
  totalCategories.innerText = await getCollectionCount("categories");
  totalUsers.innerText = await getCollectionCount("users");
  totalOrders.innerText = await getCollectionCount("orders");
  
  // Gán số lượng danh mục con vào giao diện
  if (totalSubCategories) {
    totalSubCategories.innerText = await getSubCategoriesCount();
  }
}

/* ================= LOAD RECENT PRODUCTS ================= */
async function loadRecentProducts() {
  if (!recentProducts) return;
  recentProducts.innerHTML = "";

  try {
    const q = query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      recentProducts.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 25px; color: #777; font-style: italic;">
            Chưa có sản phẩm nào trên hệ thống
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const product = docSnap.data();
      const tr = document.createElement("tr");

      // Xử lý chuỗi hiển thị danh mục phân cấp mượt mà
      let categoryDisplay = "";
      if (product.categoryName) {
        categoryDisplay = `<span class="main-cat-badge">${product.categoryName}</span>`;
        if (product.subCategoryName) {
          categoryDisplay += ` <span class="cat-arrow">→</span> <span class="sub-cat-badge">${product.subCategoryName}</span>`;
        }
      } else {
        categoryDisplay = `<span style="color: #999; font-style: italic;">Chưa phân loại</span>`;
      }

      tr.innerHTML = `
        <td>
          <img
            src="${product.image || "https://placehold.co/70x70?text=No+Image"}"
            alt="${product.name || 'product'}"
          >
        </td>
        <td><strong>${product.name || ""}</strong></td>
        <td>
          <span class="product-price-text">
            ${Number(product.price || 0).toLocaleString("vi-VN")} VNĐ
          </span>
        </td>
        <td>
          <div class="category-hierarchy-container">
            ${categoryDisplay}
          </div>
        </td>
      `;

      recentProducts.appendChild(tr);
    });

  } catch (err) {
    console.error("Lỗi tải danh sách sản phẩm mới nhất:", err);
    recentProducts.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: #e53935; padding: 20px;">
          Không thể tải dữ liệu sản phẩm mới nhất từ máy chủ.
        </td>
      </tr>
    `; 
  }
}

/* ================= SECURITY CHECK & INIT ================= */
// Thực hiện bắt buộc lắng nghe trạng thái đăng nhập để chặn đứng quyền truy cập trái phép
onAuthStateChanged(auth, (user) => {
  if (user && user.email === "tranvominhluan8@gmail.com") {
    // Thông báo xác nhận tài khoản quản trị viên tối cao thành công
    console.log("Xác thực thành công: Đã đăng nhập bằng tài khoản Admin tối cao.");
    
    // Khởi chạy nạp dữ liệu thống kê khi tài khoản hợp lệ
    loadStats();
    loadRecentProducts();
  } else {
    // Đưa ra thông báo cảnh báo nghiêm trọng nếu cố tình đăng nhập trái phép
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
    
    // Xóa định danh trạng thái ghi nhớ cũ (nếu có) và đẩy ra trang đăng nhập
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});