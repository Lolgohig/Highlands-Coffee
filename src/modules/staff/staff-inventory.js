import { db, auth } from "../../../src/services/firebase.config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM ELEMENTS ================= */
const staffProductList = document.getElementById("staff-product-list");
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* ================= NAVBAR DROPDOWN WORKSPACE ================= */
if (avatarBtn && dropdownMenu) {
  avatarBtn.onclick = (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
  };
  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown")) {
      dropdownMenu.classList.remove("show");
    }
  };
}

/* ================= SECURITY AUTH CHECK FOR CASHIER ROLE ================= */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      // ĐỌC TRỰC TIẾP TỪ COLLECTION "users" BẰNG UID CỦA TÀI KHOẢN ĐĂNG NHẬP
      const userSnap = await getDoc(doc(db, "users", user.uid));
      
      // Kiểm tra sự tồn tại dữ liệu và phân quyền role đúng "cashier" hay không
      if (userSnap.exists() && userSnap.data().role === "cashier") {
        console.log("Xác thực thành công thông tin kiểm kho món của Cashier từ collection users.");
        
        // Đổ ảnh đại diện nhân viên lên góc màn hình navbar
        if (userSnap.data().avatar && avatarBtn) {
          avatarBtn.src = userSnap.data().avatar;
        }

        // Tải danh sách món ăn lên bảng hiển thị
        loadStaffProducts();
      } else {
        alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang kiểm tra kho hàng!");
        await signOut(auth);
        localStorage.removeItem("rememberUser");
        window.location.href = "auth.html";
      }
    } catch (err) {
      console.error("Lỗi xác minh phân quyền nhân sự:", err);
      alert("Hệ thống không thể định danh tài khoản nhân viên.");
      window.location.href = "auth.html";
    }
  } else {
    alert("Vui lòng đăng nhập hệ thống!");
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});

/* ================= LOGOUT ACTION ================= */
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

/* ================= LOAD PRODUCTS ================= */
async function loadStaffProducts() {
  if (!staffProductList) return;
  staffProductList.innerHTML = "";

  try {
    const todayStr = new Date().toLocaleDateString("sv-SE"); // Định dạng mốc ngày 'YYYY-MM-DD'
    const snapshot = await getDocs(collection(db, "products"));
    
    // Tạo một mảng tạm thời để lưu cấu trúc đối tượng phục vụ tính năng sắp xếp nhóm món
    let productsArray = [];

    for (const docSnap of snapshot.docs) {
      let product = docSnap.data();
      const productId = docSnap.id;

      /* MECHANISM: TỰ ĐỘNG KHÔI PHỤC TRẠNG THÁI "CÒN HÀNG" KHI BƯỚC SANG NGÀY MỚI */
      if (product.lastResetDate !== todayStr) {
        try {
          await updateDoc(doc(db, "products", productId), {
            status: "in-stock",
            lastResetDate: todayStr
          });
          product.status = "in-stock";
          product.lastResetDate = todayStr;
          console.log(`Đã tự động khôi phục trạng thái 'Còn hàng' đầu ngày cho món: ${product.name}`);
        } catch (resetErr) {
          console.warn(`Tạm thời chưa đồng bộ được ngày mới cho món ${product.name}:`, resetErr.message);
        }
      }

      // Đẩy id của document vào để quản lý nút bấm
      product.id = productId;
      productsArray.push(product);
    }

    /* ================= THUẬT TOÁN SẮP XẾP SẢN PHẨM PHÍA STAFF ================= */
    productsArray.sort((a, b) => {
      // 1. So sánh tên danh mục chính (Category) trước
      const catA = a.categoryName || "";
      const catB = b.categoryName || "";
      if (catA !== catB) return catA.localeCompare(catB, "vi");

      // 2. Nếu cùng danh mục chính, tiến hành so sánh danh mục con (Sub-Category)
      const subA = a.subCategoryName || "";
      const subB = b.subCategoryName || "";
      if (subA !== subB) return subA.localeCompare(subB, "vi");

      // 3. Nếu trùng cả danh mục chính và con, kiểm tra xem có phải danh mục đổi điểm không
      if (a.categoryName === "Sản phẩm sử dụng điểm" || b.categoryName === "Sản phẩm sử dụng điểm") {
        return (a.pointsRequired || 0) - (b.pointsRequired || 0); // Sắp xếp theo số điểm tăng dần
      }
      
      // 4. Các danh mục thông thường sẽ sắp xếp theo giá tiền mặt tăng dần
      return (a.price || 0) - (b.price || 0);
    });

    // Vòng lặp render mảng đã qua xử lý sắp xếp lên giao diện bảng kiểm kho
    productsArray.forEach((product) => {
      const tr = document.createElement("tr");

      let costDisplay = "";
      if (product.categoryName === "Sản phẩm sử dụng điểm" || product.pointsRequired > 0) {
        costDisplay = `<span class="points-badge">${(product.pointsRequired || 0).toLocaleString("vi-VN")} Điểm</span>`;
      } else {
        costDisplay = `<span class="price-text">${Number(product.price || 0).toLocaleString("vi-VN")} VNĐ</span>`;
      }

      let statusBadgeHTML = "";
      let actionButtonHTML = "";

      if (product.status === "out-of-stock") {
        statusBadgeHTML = `<span class="status-badge-out">Hết hàng</span>`;
        actionButtonHTML = `<button class="btn-toggle-stock to-in" data-id="${product.id}">Mở lại món</button>`;
      } else {
        statusBadgeHTML = `<span class="status-badge-in">Còn hàng</span>`;
        actionButtonHTML = `<button class="btn-toggle-stock to-out" data-id="${product.id}">Báo hết món</button>`;
      }

      const displaySubName = product.subCategoryName || `<span class="no-sub-text">Không có</span>`;

      tr.innerHTML = `
        <td><img src="${product.image || 'https://via.placeholder.com/60'}" class="product-img"></td>
        <td><strong>${product.name}</strong></td>
        <td>${costDisplay}</td>
        <td><span class="main-cat-text">${product.categoryName || "Chưa rõ"}</span></td>
        <td><span class="sub-cat-text">${displaySubName}</span></td>
        <td class="desc-cell">${product.description || ""}</td>
        <td>${statusBadgeHTML}</td>
        <td>${actionButtonHTML}</td>
      `;

      const toggleBtn = tr.querySelector(".btn-toggle-stock");
      if (toggleBtn) {
        toggleBtn.onclick = async (e) => {
          e.preventDefault();
          const targetId = e.target.dataset.id;
          const newStatus = product.status === "in-stock" ? "out-of-stock" : "in-stock";
          
          try {
            await updateDoc(doc(db, "products", targetId), {
              status: newStatus,
              lastResetDate: todayStr
            });
            console.log(`Đổi trạng thái món thành công: ${newStatus}`);
            loadStaffProducts();
          } catch (toggleErr) {
            console.error("Lỗi thực thi thay đổi dữ liệu từ phía Cashier:", toggleErr);
            alert("Lỗi phân quyền hoặc lỗi kết nối: Không thể đổi trạng thái món ăn!");
          }
        };
      }

      staffProductList.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi nạp danh sách sản phẩm:", err);
  }
}