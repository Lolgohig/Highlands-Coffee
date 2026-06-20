import {
  db,
  auth
} from "../../../services/firebase.config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM ELEMENTS ================= */
const totalRevenue = document.getElementById("total-revenue");
const totalOrders = document.getElementById("total-orders");
const completedOrders = document.getElementById("completed-orders");
const totalProductsSold = document.getElementById("total-products-sold");
const bestSellers = document.getElementById("best-sellers");
const subCategoriesReport = document.getElementById("sub-categories-report");
const recentOrders = document.getElementById("recent-orders");

/* ================= NAVBAR & ACCOUNT ================= */
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* ================= DROPDOWN WORKFLOW ================= */
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

/* ================= SECURITY AUTH & ADMIN VERIFICATION ================= */
onAuthStateChanged(auth, async (user) => {
  if (user && user.email === "tranvominhluan8@gmail.com") {
    console.log("Xác thực thành công: Đã đăng nhập bằng tài khoản Admin tối cao.");
    
    // Tải thông tin ảnh đại diện Admin từ Firestore
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().avatar && avatarBtn) {
        avatarBtn.src = userSnap.data().avatar;
      }
    } catch (err) {
      console.error("Lỗi tải avatar Admin:", err);
    }

    // Kích hoạt nạp hệ thống báo cáo thống kê sau khi đã kiểm tra quyền hạn hợp lệ
    loadReports();
    loadRecentOrders();
  } else {
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});

/* ================= LOGOUT MANAGEMENT ================= */
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("rememberUser");
      window.location.href = "auth.html";
    } catch (err) {
      console.error("Lỗi khi đăng xuất:", err);
    }
  };
}

/* ================= LOAD REPORTS WORKSPACE ================= */
async function loadReports() {
  try {
    const snapshot = await getDocs(collection(db, "orders"));

    let revenue = 0;
    let completed = 0;
    let sold = 0;

    const productMap = {};
    const subCategoryMap = {}; // Khởi tạo Map tích lũy sản lượng theo Sub-category từ cart.js

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();

      // Chỉ ghi nhận số liệu và sản phẩm từ các đơn hàng đã Hoàn thành (Completed)
      if (order.status === "Completed") {
        revenue += Number(order.totalCashPaid || 0);
        completed++;

        /* XỬ LÝ MẢNG ITEMS TRONG ĐƠN HÀNG ĐÃ HOÀN THÀNH */
        if (order.items && order.items.length > 0) {
          order.items.forEach((item) => {
            const qty = Number(item.quantity || 0);
            sold += qty;

            // 1. Thống kê số lượng bán theo tên sản phẩm cụ thể
            if (!productMap[item.name]) {
              productMap[item.name] = 0;
            }
            productMap[item.name] += qty;

            // 2. Thống kê theo Danh mục con (Đọc trực tiếp từ trường subCategoryName do cart.js tạo)
            const subName = item.subCategoryName || "Chưa phân loại / Khác";
            if (!subCategoryMap[subName]) {
              subCategoryMap[subName] = 0;
            }
            subCategoryMap[subName] += qty;
          });
        }
      }
    });

    /* HIỂN THỊ TỔNG HỢP SỐ LIỆU LÊN GIAO DIỆN CARD DASHBOARD */
    if (totalRevenue) totalRevenue.innerText = Number(revenue).toLocaleString("vi-VN") + " VNĐ";
    if (totalOrders) totalOrders.innerText = snapshot.size;
    if (completedOrders) completedOrders.innerText = completed;
    if (totalProductsSold) totalProductsSold.innerText = sold;

    /* IN DANH SÁCH MÓN BÁN CHẠY (TOP 5) */
    if (bestSellers) {
      bestSellers.innerHTML = "";
      const sortedProducts = Object.entries(productMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (sortedProducts.length === 0) {
        bestSellers.innerHTML = `<tr><td colspan="2" style="color: #999; font-style: italic; text-align: center;">Chưa có dữ liệu món bán</td></tr>`;
      } else {
        sortedProducts.forEach((item) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${item[0]}</strong></td>
            <td><span class="report-badge product-badge" style="background-color: #e3f2fd; color: #0d47a1; font-weight: bold; padding: 4px 10px; border-radius: 12px;">${item[1]} sản phẩm</span></td>
          `;
          bestSellers.appendChild(tr);
        });
      }
    }

    /* IN DANH SÁCH DANH MỤC CON TIÊU THỤ MẠNH NHẤT (HIỆU SUẤT CAO NHẤT) */
    if (subCategoriesReport) {
      subCategoriesReport.innerHTML = "";
      const sortedSubCategories = Object.entries(subCategoryMap)
        .sort((a, b) => b[1] - a[1]);

      if (sortedSubCategories.length === 0) {
        subCategoriesReport.innerHTML = `<tr><td colspan="2" style="color: #999; font-style: italic; text-align: center;">Chưa có dữ liệu phân loại danh mục</td></tr>`;
      } else {
        sortedSubCategories.forEach((sub) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><span class="sub-category-text" style="font-weight: 600; color: #4e342e;">${sub[0]}</span></td>
            <td><span class="report-badge subcat-badge" style="background-color: #fff3e0; color: #e65100; font-weight: bold; padding: 4px 10px; border-radius: 12px; border: 1px solid #ffe0b2;">${sub[1]} ly đã bán</span></td>
          `;
          subCategoriesReport.appendChild(tr);
        });
      }
    }

  } catch (err) {
    console.error("Lỗi trích xuất báo cáo thống kê:", err);
  }
}

/* ================= LOAD RECENT ORDERS (BẢNG ĐƠN HÀNG GẦN ĐÂY) ================= */
async function loadRecentOrders() {
  try {
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const snapshot = await getDocs(q);
    if (!recentOrders) return;
    recentOrders.innerHTML = "";

    if (snapshot.empty) {
      recentOrders.innerHTML = `<tr><td colspan="3" style="color: #999; font-style: italic; text-align: center;">Không có đơn hàng gần đây</td></tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const tr = document.createElement("tr");

      // Định dạng Class màu sắc trạng thái dựa trên dữ liệu đơn hàng
      let statusClass = "status-badge-pending";
      if (order.status === "Completed") statusClass = "status-badge-completed";
      if (order.status === "Cancelled") statusClass = "status-badge-cancelled";
      if (order.status === "Preparing" || order.status === "Delivering") statusClass = "status-badge-processing";

      const priceDisplay = Number(order.totalCashPaid || 0);

      tr.innerHTML = `
        <td>${order.customerName || "Khách vãng lai"}</td>
        <td><strong>${priceDisplay.toLocaleString("vi-VN")} VNĐ</strong></td>
        <td><span class="status-indicator-text ${statusClass}">${order.status || "Pending"}</span></td>
      `;

      recentOrders.appendChild(tr);
    });

  } catch (err) {
    console.error("Lỗi khi kết nối danh sách đơn hàng gần đây:", err);
  }
}