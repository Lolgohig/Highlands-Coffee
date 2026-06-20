import { db, auth } from "../../../src/services/firebase.config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM ELEMENTS ================= */
const staffOrdersList = document.getElementById("staff-orders-list");
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* ================= NAVBAR DROPDOWN SYSTEM ================= */
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

/* ================= SECURITY AUTH & CASHIER ROLE VERIFICATION ================= */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      // ĐỌC TRỰC TIẾP TỪ COLLECTION "users" BẰNG UID CỦA TÀI KHOẢN ĐĂNG NHẬP
      const userSnap = await getDoc(doc(db, "users", user.uid));
      
      // Kiểm tra xem user có tồn tại trong database và có đúng role là "cashier" không
      if (userSnap.exists() && userSnap.data().role === "cashier") {
        console.log("Xác thực thành công: Đã đăng nhập bằng tài khoản Cashier từ collection users.");
        
        // Đổ ảnh đại diện của nhân viên lên navbar nếu có dữ liệu avatar
        if (userSnap.data().avatar && avatarBtn) {
          avatarBtn.src = userSnap.data().avatar;
        }

        // Kích hoạt nạp danh sách đơn hàng cho nhân viên xử lý
        loadStaffOrders();
      } else {
        // Nếu tài khoản tồn tại nhưng không phải role cashier (ví dụ tài khoản khách hàng cố tình vào)
        alert("Cảnh báo: Bạn không có quyền truy cập vào trang làm việc của Nhân viên!");
        await signOut(auth);
        localStorage.removeItem("rememberUser");
        window.location.href = "auth.html";
      }
    } catch (err) {
      console.error("Lỗi trong quá trình xác thực phân quyền:", err);
      alert("Hệ thống gặp sự cố khi xác thực tài khoản.");
      window.location.href = "auth.html";
    }
  } else {
    // Trường hợp chưa đăng nhập bất cứ tài khoản nào
    alert("Vui lòng đăng nhập bằng tài khoản nhân viên để tiếp tục làm việc!");
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});

/* ================= LOGOUT WORKFLOW ================= */
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("rememberUser");
      window.location.href = "auth.html";
    } catch (err) {
      console.error("Lỗi đăng xuất:", err);
    }
  };
}

/* ================= LOAD AND RENDER ORDERS ================= */
async function loadStaffOrders() {
  if (!staffOrdersList) return;
  staffOrdersList.innerHTML = "";

  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // ĐÃ SỬA: Tăng colspan lên 8 để vừa vặn với việc thêm cột địa chỉ mới
      staffOrdersList.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888; font-style:italic;">Hiện chưa có đơn hàng nào được tạo</td></tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const tr = document.createElement("tr");

      let itemsHTML = `<ul class="order-items-list">`;
      if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
          itemsHTML += `<li>• <strong>${item.name}</strong> x ${item.quantity} (Size: ${item.size || 'M'})</li>`;
        });
      } else {
        itemsHTML += `<li>Không có dữ liệu chi tiết</li>`;
      }
      itemsHTML += `</ul>`;

      let timeDisplay = "Chưa rõ thời gian";
      if (order.createdAt) {
        const dateObj = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        timeDisplay = dateObj.toLocaleString("vi-VN");
      }

      const currentStatus = order.status || "Pending";
      
      // KIỂM TRA KHÓA TRẠNG THÁI: Nếu đơn hàng đã Completed hoặc Cancelled thì khóa (disabled) select
      const isLocked = currentStatus === "Completed" || currentStatus === "Cancelled";
      const disabledAttr = isLocked ? "disabled style='background-color: #e9ecef; cursor: not-allowed; color: #555;'" : "";

      const statusSelectHTML = `
        <select class="status-select-inline" data-id="${docSnap.id}" ${disabledAttr}>
          <option value="Pending" ${currentStatus === "Pending" ? "selected" : ""}>Chờ xác nhận</option>
          <option value="Preparing" ${currentStatus === "Preparing" ? "selected" : ""}>Đang pha chế</option>
          <option value="Delivering" ${currentStatus === "Delivering" ? "selected" : ""}>Đang giao</option>
          <option value="Completed" ${currentStatus === "Completed" ? "selected" : ""}>Đã hoàn thành</option>
          <option value="Cancelled" ${currentStatus === "Cancelled" ? "selected" : ""}>Hủy đơn</option>
        </select>
      `;

      // ĐÃ CẬP NHẬT: Thêm cột hiển thị địa chỉ giao hàng lấy từ field `order.address`
      tr.innerHTML = `
        <td><strong>${order.customerName || "Khách vãng lai"}</strong></td>
        <td>${order.phone || "Không cung cấp"}</td>
        <td class="order-address-cell" style="max-width: 250px; font-size: 0.9rem; color: #333; word-break: break-word;">${order.address || "Nhận tại quán / Không rõ địa chỉ"}</td>
        <td>${itemsHTML}</td>
        <td><strong style="color: #7b001f;">${Number(order.totalCashPaid || 0).toLocaleString("vi-VN")} VNĐ</strong></td>
        <td><span class="badge-payment">${order.paymentMethod || "Tiền mặt"}</span></td>
        <td><span class="time-display">${timeDisplay}</span></td>
        <td>${statusSelectHTML}</td>
      `;

      const selectEl = tr.querySelector(".status-select-inline");
      
      // Nếu chưa bị khóa thì gán sự kiện thay đổi trạng thái
      if (!isLocked) {
        selectEl.onchange = async (e) => {
          const newStatus = e.target.value;
          const orderId = e.target.dataset.id;
          
          try {
            // Trường hợp 1: Chuyển sang hoàn thành ĐỒNG THỜI đủ điều kiện tích điểm
            if (newStatus === "Completed" && !order.isPointsRewarded) {
              const userId = order.userId;
              const totalCashPaid = Number(order.totalCashPaid || 0);

              if (userId && totalCashPaid > 0) {
                const pointsEarned = Math.floor(totalCashPaid / 10000);

                if (pointsEarned > 0) {
                  const userRef = doc(db, "users", userId);
                  const userSnap = await getDoc(userRef);

                  if (userSnap.exists()) {
                    // Tiến hành cộng điểm vào tài khoản khách hàng trước
                    await updateDoc(userRef, {
                      loyaltyPoints: increment(pointsEarned)
                    });
                    console.log(`Đã cộng tích lũy +${pointsEarned} điểm cho khách hàng.`);
                  }
                }
              }

              // Cập nhật trạng thái đơn hàng kèm cờ đánh dấu đã cộng điểm TRONG CÙNG MỘT LỆNH GHI
              await updateDoc(doc(db, "orders", orderId), {
                status: newStatus,
                isPointsRewarded: true,
                updatedAt: new Date()
              });
              order.isPointsRewarded = true;

            } else {
              // Trường hợp 2: Chuyển sang các trạng thái thông thường khác (Preparing, Delivering, Cancelled...)
              await updateDoc(doc(db, "orders", orderId), {
                status: newStatus,
                updatedAt: new Date()
              });
            }

            console.log(`Đã cập nhật thành công đơn ${orderId} sang trạng thái: ${newStatus}`);

            // Khóa cứng select và hiển thị thông báo nếu chọn Hoàn tất hoặc Hủy đơn
            if (newStatus === "Completed" || newStatus === "Cancelled") {
              selectEl.disabled = true;
              selectEl.style.backgroundColor = "#e9ecef";
              selectEl.style.cursor = "not-allowed";
              selectEl.style.cursor = "not-allowed";
              selectEl.style.color = "#555";
              
              if (newStatus === "Completed") {
                alert("Đơn hàng hoàn tất! Điểm tích lũy đã được gửi đến khách hàng và trạng thái đơn đã khóa thành công.");
              } else {
                alert("Đã hủy đơn hàng! Trạng thái đơn đã được khóa bảo mật thành công.");
              }
            }

          } catch (statusErr) {
            console.error("Lỗi cập nhật dữ liệu vận hành hệ thống:", statusErr);
            alert("Lỗi phân quyền hệ thống hoặc lỗi mạng. Không thể lưu trạng thái đơn hàng!");
          }
        };
      }

      staffOrdersList.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách đơn hàng:", err);
  }
}