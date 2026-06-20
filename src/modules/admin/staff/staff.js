import {
  db,
  auth
} from "../../../services/firebase.config.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  CLOUDINARY_API
} from "../../../services/cloudinary.config.js";

/* ================= DOM SELECTORS ================= */
const form = document.getElementById("staff-form");
const staffIdInput = document.getElementById("staff-id");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const roleInput = document.getElementById("role");
const activeInput = document.getElementById("active");
const baseSalaryInput = document.getElementById("base-salary");
const violationMoneyInput = document.getElementById("violation-money");
const violationNoteInput = document.getElementById("violation-note");
const salaryPaidInput = document.getElementById("salary-paid");
const staffImageInput = document.getElementById("staff-image");
const uploadStatus = document.getElementById("upload-status");
const staffList = document.getElementById("staff-list");

/* ================= NAVBAR & DROPDOWN ================= */
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

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
    
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().avatar && avatarBtn) {
        avatarBtn.src = userSnap.data().avatar;
      }
    } catch (err) {
      console.error("Lỗi tải avatar Admin:", err);
    }

    loadStaff();
  } else {
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
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

/* ================= CLOUDINARY ================= */
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_API.uploadPreset);
  uploadStatus.innerText = "Đang upload ảnh...";

  const response = await fetch(
    CLOUDINARY_API.uploadUrl,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }

  uploadStatus.innerText = "Upload thành công!";
  return data.secure_url;
}

/* ================= ĐỊNH DẠNG TÊN HÌNH THỨC ROLE VIỆT HÓA (ĐÃ XÓA MANAGER) ================= */
function getRoleBadge(role) {
  switch (role) {
    case "cashier": return "<span class='badge bg-cashier'>Thu ngân</span>";
    case "barista": return "<span class='badge bg-barista'>Pha chế</span>";
    default: return "<span class='badge bg-cashier'>Thu ngân</span>"; 
  }
}

/* ================= LOAD STAFF & ATTENDANCE MANAGEMENT ================= */
async function loadStaff() {
  if (!staffList) return;
  staffList.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "staff"));

    snapshot.forEach((docSnap) => {
      const staff = docSnap.data();
      const staffId = docSnap.id;
      const realSalary = Number(staff.baseSalary || 0) - Number(staff.violationMoney || 0);

      // Xử lý chuỗi ngày điểm danh chấm công
      const attendanceDays = staff.attendanceDays || [];
      const totalWorkDays = attendanceDays.length;

      // Xác định trạng thái chấm công của ngày hôm nay (YYYY-MM-DD)
      const todayStr = new Date().toISOString().split('T')[0];
      let todayAttendanceStatus = "Chưa điểm danh";
      let statusClass = "status-uncheck";

      // Kiểm tra trong mảng log chấm công hôm nay
      const todayLog = attendanceDays.find(log => log.date === todayStr);
      if (todayLog) {
        if (todayLog.status === "present") {
          todayAttendanceStatus = "🟢 Có đi làm";
          statusClass = "status-present";
        } else if (todayLog.status === "leave") {
          todayAttendanceStatus = "🟡 Nghỉ phép";
          statusClass = "status-leave";
        }
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img src="${staff.avatar || 'https://i.pravatar.cc/100'}" class="staff-avatar">
        </td>
        <td>
          <div class="staff-meta-name">${staff.name || ""}</div>
          <div class="staff-meta-email">${staff.email || ""}</div>
        </td>
        <td>${getRoleBadge(staff.role)}</td>
        <td>${staff.active ? "<span class='status-active'>🟢 Đang làm</span>" : "<span class='status-disabled'>🔴 Nghỉ</span>"}</td>
        <td>
          <div class="attendance-control">
            <span class="attendance-status-label ${statusClass}">${todayAttendanceStatus}</span>
            <select class="admin-change-attendance" data-id="${staffId}">
              <option value="" disabled selected>Thay đổi trạng thái</option>
              <option value="present">Có đi làm</option>
              <option value="leave">Nghỉ phép</option>
              <option value="absent">Chưa đi làm / Xóa điểm danh</option>
            </select>
          </div>
        </td>
        <td class="text-center font-bold text-dark">${totalWorkDays} ngày</td>
        <td>${Number(staff.baseSalary || 0).toLocaleString("vi-VN")} đ</td>
        <td class="text-danger">${Number(staff.violationMoney || 0).toLocaleString("vi-VN")} đ</td>
        <td class="font-bold text-success">${realSalary.toLocaleString("vi-VN")} đ</td>
        <td class="violation-note-cell">${staff.violationNote || "<span class='text-muted'>Không có</span>"}</td>
        <td>${staff.salaryPaid ? "<span class='paid-badge paid'>✅ Đã trả</span>" : "<span class='paid-badge unpaid'>❌ Chưa</span>"}</td>
        <td>
          <div class="action-btns">
            <button class="edit-btn">Sửa</button>
            <button class="delete-btn">Xóa</button>
          </div>
        </td>
      `;

      /* ================= EVENT: ADMIN THAY ĐỔI TRẠNG THÁI ĐIỂM DANH ================= */
      tr.querySelector(".admin-change-attendance").onchange = async (e) => {
        const selectedStatus = e.target.value;
        let updatedAttendance = [...attendanceDays];
        
        // Loại bỏ bản ghi cũ của ngày hôm nay nếu có sẵn để ghi đè dữ liệu mới
        updatedAttendance = updatedAttendance.filter(log => log.date !== todayStr);

        if (selectedStatus === "present" || selectedStatus === "leave") {
          updatedAttendance.push({
            date: todayStr,
            status: selectedStatus,
            markedBy: "Admin",
            markedAt: new Date().toISOString()
          });
        }
        
        try {
          await updateDoc(doc(db, "staff", staffId), {
            attendanceDays: updatedAttendance
          });
          alert(`Đã cập nhật điểm danh hôm nay cho nhân viên: ${staff.name}`);
          loadStaff();
        } catch (err) {
          alert("Lỗi khi cập nhật chấm công: " + err.message);
        }
      };

      /* ================= EVENT: DELETE ================= */
      tr.querySelector(".delete-btn").onclick = async () => {
        const confirmDelete = confirm(`Xóa nhân viên "${staff.name}" ?`);
        if (!confirmDelete) return;

        try {
          await deleteDoc(doc(db, "staff", docSnap.id));
          loadStaff();
        } catch (err) {
          alert("Lỗi khi xóa nhân viên: " + err.message);
        }
      };

      /* ================= EVENT: EDIT ================= */
      tr.querySelector(".edit-btn").onclick = () => {
        staffIdInput.value = docSnap.id;
        nameInput.value = staff.name || "";
        emailInput.value = staff.email || "";
        roleInput.value = staff.role || "cashier";
        activeInput.value = String(staff.active ?? true);
        baseSalaryInput.value = staff.baseSalary || 0;
        violationMoneyInput.value = staff.violationMoney || 0;
        violationNoteInput.value = staff.violationNote || "";
        salaryPaidInput.checked = staff.salaryPaid || false;

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      };

      staffList.appendChild(tr);
    });

  } catch (err) {
    console.error("Lỗi khi tải danh sách nhân viên:", err);
  }
}

/* ================= SAVE STAFF ================= */
form.onsubmit = async (e) => {
  e.preventDefault();

  try {
    const id = staffIdInput.value;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleInput.value;
    const active = activeInput.value === "true";
    const baseSalary = Number(baseSalaryInput.value);
    const violationMoney = Number(violationMoneyInput.value);
    const violationNote = violationNoteInput.value; 

    /* VALIDATION */
    if (name.length < 2) {
      alert("Tên quá ngắn!");
      return;
    }

    if (!email.includes("@")) {
      alert("Email không hợp lệ!");
      return;
    }

    let avatarUrl = "";

    /* IMAGE UPLOAD */
    if (staffImageInput.files[0]) {
      avatarUrl = await uploadImage(staffImageInput.files[0]);
    }

    /* DATA MANAGEMENT */
    const staffData = {
      name,
      email,
      role,
      active,
      baseSalary,
      violationMoney,
      violationNote,
      salaryPaid: salaryPaidInput.checked,
      updatedAt: new Date()
    };

    if (avatarUrl) {
      staffData.avatar = avatarUrl;
    }

    /* EXECUTE: UPDATE */
    if (id) {
      await updateDoc(doc(db, "staff", id), staffData);
      alert("Cập nhật thành công!");
    } 
    /* EXECUTE: CREATE */
    else {
      if (!avatarUrl) {
        alert("Vui lòng chọn ảnh cho nhân viên mới!");
        return;
      }
      staffData.avatar = avatarUrl;
      staffData.createdAt = new Date();
      staffData.attendanceDays = []; // Tạo mảng rỗng lưu lịch sử đi làm tích lũy

      await addDoc(collection(db, "staff"), staffData);
      alert("Thêm nhân viên mới thành công!");
    }

    /* FORM SYSTEM RESET */
    form.reset();
    staffIdInput.value = "";
    uploadStatus.innerText = "";
    loadStaff();

  } catch (err) {
    console.error("Lỗi khi lưu thông tin nhân viên:", err);
    alert(err.message);
  }
};