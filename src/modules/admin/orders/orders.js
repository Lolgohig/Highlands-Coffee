import {
  db,
  auth
} from "../../../services/firebase.config.js";

import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  getDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM ================= */
const ordersList = document.getElementById("orders-list");

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

/* ================= SECURITY AUTH & ADMIN VERIFICATION ================= */
onAuthStateChanged(auth, async (user) => {
  if (user && user.email === "tranvominhluan8@gmail.com") {
    console.log("Xác thực thành công: Đã đăng nhập bằng tài khoản Admin tối cao.");
    
    // Tải thông tin ảnh đại diện Admin
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().avatar && avatarBtn) {
        avatarBtn.src = userSnap.data().avatar;
      }
    } catch (err) {
      console.error("Lỗi tải avatar Admin:", err);
    }

    // Kích hoạt nạp danh sách đơn hàng sau khi đã kiểm tra quyền hạn hợp lệ
    loadOrders();
  } else {
    // Đưa ra thông báo cảnh báo nghiêm trọng nếu cố tình truy cập trái phép
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
    
    // Xóa định danh trạng thái ghi nhớ cũ (nếu có) và đẩy ra trang đăng nhập
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});

/* ================= LOGOUT ================= */
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

/* ================= STATUS CLASS ================= */
function getStatusClass(status) {
  switch (status) {
    case "Pending":
      return "pending";
    case "Preparing":
      return "preparing";
    case "Delivering":
      return "delivering";
    case "Completed":
      return "completed";
    case "Cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  if (!ordersList) return;
  ordersList.innerHTML = "";

  try {
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      ordersList.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 30px; color: #666; font-style: italic;">
            Chưa có đơn hàng nào hệ thống
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const tr = document.createElement("tr");

      /* XỬ LÝ THỜI GIAN TẠO ĐƠN CHÍNH XÁC (HỖ TRỢ CẢ TIMESTAMP VÀ ISO STRING) */
      let createdAt = "Không có";
      if (order.createdAt) {
        if (typeof order.createdAt.toDate === "function") {
          createdAt = order.createdAt.toDate().toLocaleString("vi-VN");
        } else if (typeof order.createdAt === "string") {
          createdAt = new Date(order.createdAt).toLocaleString("vi-VN");
        }
      }

      /* XỬ LÝ HIỂN THỊ CHI TIẾT MÓN ĐẶT KÈM SIZE VÀ SỐ LƯỢNG */
      let itemsHtml = `<div class="order-items-wrapper">`;
      if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
          const subBadge = item.subCategoryName 
            ? `<span class="item-sub-badge">${item.subCategoryName}</span>` 
            : "";
          
          // Thể hiện size của từng món đặt
          const sizeInfo = item.size ? ` [Size ${item.size.toUpperCase()}]` : "";

          itemsHtml += `
            <div class="order-item-line" style="margin-bottom: 4px;">
              <span class="item-name">· <strong>${item.name}${sizeInfo}</strong> x${item.quantity || 1}</span>
              ${subBadge}
            </div>
          `;
        });
      } else {
        itemsHtml += `<span style="color: #999; font-style: italic;">Không có dữ liệu món</span>`;
      }
      itemsHtml += `</div>`;

      /* LẤY CHÍNH XÁC TRƯỜNG totalCashPaid BAO GỒM CẢ TIỀN SHIP VÀ TIỀN ĐƠN */
      const finalPrice = Number(order.totalCashPaid || 0);

      // Render dòng dữ liệu của bảng (Thêm cột chứa địa chỉ order.address)
      tr.innerHTML = `
        <td><strong>#${docSnap.id.slice(0, 8).toUpperCase()}</strong></td>
        <td>${order.customerName || "Khách vãng lai"}</td>
        <td>${order.phone || "Không có"}</td>
        <td style="max-width: 220px; word-break: break-word; font-size: 0.9rem; color: #444;">${order.address || "Nhận tại quán / Không có địa chỉ"}</td>
        <td>${itemsHtml}</td>
        <td><span class="order-price" style="color: #b71c1c; font-weight: bold;">${finalPrice.toLocaleString("vi-VN")} VNĐ</span></td>
        <td>
          <select class="status-select ${getStatusClass(order.status)}">
            <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
            <option value="Delivering" ${order.status === "Delivering" ? "selected" : ""}>Delivering</option>
            <option value="Completed" ${order.status === "Completed" ? "selected" : ""}>Completed</option>
            <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </td>
        <td>${createdAt}</td>
        <td>
          <button class="action-btn delete-btn">Xóa</button>
        </td>
      `;

      /* THAY ĐỔI TRẠNG THÁI ĐƠN HÀNG & TÍNH TOÁN CỘNG ĐIỂM LOYALTY */
      const statusSelect = tr.querySelector(".status-select");
      statusSelect.onchange = async () => {
        try {
          const nextStatus = statusSelect.value;
          
          // Thay đổi class màu sắc lập tức trên giao diện
          statusSelect.className = `status-select ${getStatusClass(nextStatus)}`;

          // 1. Cập nhật trạng thái cơ bản của đơn hàng lên Firestore trước
          await updateDoc(doc(db, "orders", docSnap.id), {
            status: nextStatus,
            updatedAt: new Date().toISOString()
          });

          // 2. Kiểm tra nếu chuyển sang "Completed" và đơn hàng này CHƯA từng được cộng điểm (Đảm bảo chỉ cộng một lần duy nhất)
          if (nextStatus === "Completed" && !order.isPointsRewarded) {
            const userId = order.userId;
            const totalCashPaid = Number(order.totalCashPaid || 0);

            if (userId && totalCashPaid > 0) {
              // Quy đổi điểm tích lũy: 10,000 VNĐ = 1 Điểm loyaltyPoints
              const pointsEarned = Math.floor(totalCashPaid / 10000);

              if (pointsEarned > 0) {
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                  // Tiến hành cộng dồn loyaltyPoints vào tài khoản User
                  await updateDoc(userRef, {
                    loyaltyPoints: increment(pointsEarned)
                  });

                  // Đánh dấu đơn hàng này đã xử lý cộng điểm thành công để không bị cộng lặp lại
                  await updateDoc(doc(db, "orders", docSnap.id), {
                    isPointsRewarded: true
                  });

                  // Cập nhật lại giá trị cục bộ local để tránh bugs nếu admin chuyển đổi liên tục tại chỗ
                  order.isPointsRewarded = true; 

                  console.log(`Cộng điểm thành công: +${pointsEarned} điểm cho khách hàng ${order.customerName}`);
                  alert(`Đơn hàng hoàn tất! Đã tích lũy +${pointsEarned} điểm vào tài khoản khách hàng.`);
                }
              }
            }
          }
        } catch (error) {
          console.error(error);
          alert("Không thể cập nhật trạng thái đơn hàng hoặc cộng điểm: " + error.message);
        }
      };

      /* XÓA ĐƠN HÀNG */
      tr.querySelector(".delete-btn").onclick = async () => {
        const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa đơn hàng #${docSnap.id.slice(0, 8).toUpperCase()}?`);
        if (!confirmDelete) return;

        try {
          await deleteDoc(doc(db, "orders", docSnap.id));
          loadOrders();
        } catch (error) {
          alert("Lỗi khi xóa: " + error.message);
        }
      };

      ordersList.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    ordersList.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: #e53935; padding: 20px;">
          Xảy ra lỗi khi tải dữ liệu đơn hàng. Vui lòng kiểm tra Console log!
        </td>
      </tr>
    `;
  }
}