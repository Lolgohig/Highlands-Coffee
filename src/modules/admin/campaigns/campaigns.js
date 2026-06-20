import { db, auth } from "../../../services/firebase.config.js";
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { CLOUDINARY_API } from "../../../services/cloudinary.config.js";

/* ================= DOM SELECTORS ================= */
const form = document.getElementById("campaign-form");
const campaignIdInput = document.getElementById("campaign-id");
const titleInput = document.getElementById("title");
const codeInput = document.getElementById("campaign-code");
const campaignTypeSelect = document.getElementById("campaign-type");
const descriptionInput = document.getElementById("description");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const bannerImageInput = document.getElementById("banner-image");
const campaignList = document.getElementById("campaign-list");
const uploadStatus = document.getElementById("upload-status");

/* DOM Các vùng chứa trường theo điều kiện */
const fieldsPercentage = document.getElementById("fields-percentage");
const discountPercentSelect = document.getElementById("discount-percent");

const fieldsFlatAmount = document.getElementById("fields-flat-amount");
const discountFlatValueInput = document.getElementById("discount-flat-value");

const fieldsBuyXGetY = document.getElementById("fields-buy-x-get-y");
const buyQtyInput = document.getElementById("buy-qty");
const getQtyInput = document.getElementById("get-qty");

const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* Mảng lưu cache danh mục tổng để phục vụ hàm lọc động */
let globalCategories = [];
let globalSubCategories = [];

/* ================= NAVBAR DROPDOWN LOGIC ================= */
if (avatarBtn && dropdownMenu) {
  avatarBtn.onclick = () => dropdownMenu.classList.toggle("show");
  window.onclick = (e) => { 
    if (!e.target.closest(".profile-dropdown")) dropdownMenu.classList.remove("show"); 
  };
}

/* ================= SECURITY AUTH & ADMIN VERIFICATION ================= */
onAuthStateChanged(auth, async (user) => {
  if (user && user.email === "tranvominhluan8@gmail.com") {
    console.log("Xác thực thành công: Đã đăng nhập bằng tài khoản Admin tối cao.");
    
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && avatarBtn) {
        avatarBtn.src = userSnap.data().avatar || "https://i.pravatar.cc/100";
      }
    } catch (err) {
      console.error("Lỗi khi tải avatar admin:", err);
    }

    // Tải danh mục trước, sau đó mới nạp dữ liệu bảng campaign
    await fetchCategoriesAndSubcategories();
    loadCampaigns();
  } else {
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});

/* ================= LOGOUT SYSTEM ================= */
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

/* ================= ĐỒNG BỘ VÀ LỌC DANH MỤC CON TỰ ĐỘNG (DYNAMIC FILTER) ================= */
async function fetchCategoriesAndSubcategories() {
  try {
    globalCategories = [];
    globalSubCategories = [];
    const snapshot = await getDocs(collection(db, "categories"));
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      globalCategories.push({ id: docSnap.id, name: data.name });
      
      if (data.subCategories && Array.isArray(data.subCategories)) {
        data.subCategories.forEach((sub) => {
          if (!globalSubCategories.some(s => s.id === sub.id)) {
            globalSubCategories.push({ id: sub.id, name: sub.name, parentId: docSnap.id });
          }
        });
      }
    });

    // Cấu hình liên kết lọc động cho từng cụm ô chọn nhóm
    setupDynamicBlock("pct-categories", "pct-subcategories", "pct-sub-wrapper");
    setupDynamicBlock("flat-categories", "flat-subcategories", "flat-sub-wrapper");
    setupDynamicBlock("buy-categories", "buy-subcategories", "buy-sub-wrapper");
    setupDynamicBlock("get-categories", "get-subcategories", "get-sub-wrapper");

  } catch (error) {
    console.error("Lỗi đồng bộ danh mục hệ thống:", error);
  }
}

/* Hàm khởi tạo danh sách Category và lắng nghe sự kiện tích chọn */
function setupDynamicBlock(catContainerId, subContainerId, wrapperId) {
  const catBox = document.getElementById(catContainerId);
  if (!catBox) return;

  // 1. Render danh mục cha trước
  catBox.innerHTML = globalCategories.map(cat => `
    <label class="multiselect-item">
      <input type="checkbox" value="${cat.id}" class="cat-checkbox">
      <span>${cat.name}</span>
    </label>
  `).join("");

  // 2. Lắng nghe sự kiện click checkbox của danh mục cha để sinh ra danh mục con tương ứng
  catBox.querySelectorAll(".cat-checkbox").forEach(checkbox => {
    checkbox.onchange = () => {
      updateSubcategoriesField(catContainerId, subContainerId, wrapperId);
    };
  });
}

/* Logic cốt lõi: Lọc danh mục con dựa trên danh mục cha được chọn */
function updateSubcategoriesField(catContainerId, subContainerId, wrapperId, checkedSubIds = []) {
  const selectedCatIds = getSelectedValues(catContainerId);
  const subBox = document.getElementById(subContainerId);
  const wrapper = document.getElementById(wrapperId);

  if (!subBox || !wrapper) return;

  if (selectedCatIds.length === 0) {
    subBox.innerHTML = "";
    wrapper.style.display = "none";
    return;
  }

  const filteredSubs = globalSubCategories.filter(sub => selectedCatIds.includes(sub.parentId));

  if (filteredSubs.length === 0) {
    wrapper.style.display = "none";
    subBox.innerHTML = "";
  } else {
    wrapper.style.display = "block";
    subBox.innerHTML = filteredSubs.map(sub => {
      const isChecked = checkedSubIds.includes(sub.id) ? "checked" : "";
      return `
        <label class="multiselect-item">
          <input type="checkbox" value="${sub.id}" class="sub-checkbox" ${isChecked}>
          <span>${sub.name}</span>
        </label>
      `;
    }).join("");
  }
}

/* Thu thập các giá trị ID được tích chọn */
function getSelectedValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const checked = container.querySelectorAll("input[type='checkbox']:checked");
  return Array.from(checked).map(cb => cb.value);
}

/* Đánh dấu chọn (check) cho các checkbox danh mục cha */
function setSelectedValues(containerId, valuesArray) {
  const container = document.getElementById(containerId);
  if (!container || !valuesArray) return;
  const checkboxes = container.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(cb => {
    cb.checked = valuesArray.includes(cb.value);
  });
}

/* Clear toàn bộ form checkbox */
function clearAllCheckboxes() {
  document.querySelectorAll(".multiselect-container input[type='checkbox']").forEach(cb => cb.checked = false);
  document.querySelectorAll(".sub-wrapper").forEach(wp => wp.style.display = "none");
}

/* ================= LOGIC ĐIỀU KHIỂN HIỂN THỊ FORM THEO LOẠI ================= */
campaignTypeSelect.onchange = () => {
  const type = campaignTypeSelect.value;
  fieldsPercentage.style.display = "none";
  fieldsFlatAmount.style.display = "none";
  fieldsBuyXGetY.style.display = "none";

  if (type === "percentage") fieldsPercentage.style.display = "block";
  else if (type === "flat_amount") fieldsFlatAmount.style.display = "block";
  else if (type === "buy_x_get_y") fieldsBuyXGetY.style.display = "block";
};

/* ================= CLOUDINARY UPLOAD ================= */
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_API.uploadPreset);
  uploadStatus.innerText = "Đang upload...";
  const res = await fetch(CLOUDINARY_API.uploadUrl, { method: "POST", body: formData });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

/* ================= LOAD ALL CAMPAIGNS TO TABLE ================= */
async function loadCampaigns() {
  if (!campaignList) return;
  campaignList.innerHTML = "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const snapshot = await getDocs(collection(db, "campaigns"));
    snapshot.forEach((docSnap) => {
      const c = docSnap.data();
      
      // Kiểm tra tính hợp lệ của ngày tháng dữ liệu từ Firestore
      const start = c.startDate ? new Date(c.startDate) : null;
      const end = c.endDate ? new Date(c.endDate) : null;
      
      let statusText = "";
      
      // Ưu tiên kiểm tra thuộc tính active thủ công từ DB trước (nếu có trường active: false)
      if (c.active === false) {
        statusText = "<span style='color: #e53935;'>🔴 Đã tắt (Ẩn)</span>";
      } else if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        statusText = "<span style='color: #ff9800;'>⚠️ Thiếu ngày</span>";
      } else {
        // Tính toán trạng thái tự động theo mốc thời gian thực tế
        if (today < start) {
          statusText = "<span style='color: #1e88e5;'>⏳ Sắp diễn ra</span>";
        } else if (today >= start && today <= end) {
          statusText = "<span style='color: #2e7d32;'>🟢 Đang hoạt động</span>";
        } else {
          statusText = "<span style='color: #757575;'>🏁 Đã kết thúc</span>";
        }
      }

      let discountDisplay = "";
      if (c.type === "percentage") {
        discountDisplay = `Giảm ${c.discountPercent}% <br><small style="color:#777;">(Theo danh mục)</small>`;
      } else if (c.type === "flat_amount") {
        discountDisplay = `Giảm ${(c.discountFlatValue || 0).toLocaleString("vi-VN")}đ <br><small style="color:#777;">(Trừ tiền món)</small>`;
      } else if (c.type === "buy_x_get_y" || (!c.type && c.buyQty)) {
        // Bổ sung kiểm tra fallback nếu trường type bị mất/lỗi nhưng có cấu hình số lượng mua
        discountDisplay = `Mua ${c.buyQty || 0} Tặng ${c.getQty || 0}`;
      } else {
        discountDisplay = `Giảm ${c.discountPercent || 0}%`;
      }

      const displayStartDate = c.startDate || "Chưa rõ";
      const displayEndDate = c.endDate || "Chưa rõ";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${c.banner || 'https://via.placeholder.com/100x60?text=No+Image'}" style="width:100px; height:60px; border-radius:8px; object-fit:cover;"></td>
        <td>${c.title || "Không có tiêu đề"}</td>
        <td>${c.code || ""}</td>
        <td>${discountDisplay}</td>
        <td>${displayStartDate} <br> ➔ <br> ${displayEndDate}</td>
        <td><strong>${statusText}</strong></td>
        <td>
          <button class="edit-btn">Sửa</button>
          <button class="delete-btn">Xóa</button>
        </td>
      `;

      tr.querySelector(".delete-btn").onclick = async () => {
        if(confirm(`Xóa "${c.title}"?`)) { 
          await deleteDoc(doc(db, "campaigns", docSnap.id)); 
          loadCampaigns(); 
        }
      };

      /* EVENT: EDIT CAMPAIGN */
      tr.querySelector(".edit-btn").onclick = () => {
        form.reset();
        clearAllCheckboxes();

        campaignIdInput.value = docSnap.id;
        titleInput.value = c.title || "";
        codeInput.value = c.code || "";
        descriptionInput.value = c.description || "";
        startDateInput.value = c.startDate || "";
        endDateInput.value = c.endDate || "";
        
        // Nhận diện kiểu loại thông minh phòng trường hợp thiếu thuộc tính type ngoài Firestore
        let type = c.type;
        if (!type && c.buyQty) type = "buy_x_get_y";
        if (!type && !c.buyQty) type = "percentage";

        campaignTypeSelect.value = type;
        campaignTypeSelect.onchange(); 

        if (type === "percentage") {
          discountPercentSelect.value = c.discountPercent || "0";
          setSelectedValues("pct-categories", c.appliedCategories || []);
          updateSubcategoriesField("pct-categories", "pct-subcategories", "pct-sub-wrapper", c.appliedSubCategories || []);
        } else if (type === "flat_amount") {
          discountFlatValueInput.value = c.discountFlatValue || "";
          setSelectedValues("flat-categories", c.appliedCategories || []);
          updateSubcategoriesField("flat-categories", "flat-subcategories", "flat-sub-wrapper", c.appliedSubCategories || []);
        } else if (type === "buy_x_get_y") {
          buyQtyInput.value = c.buyQty || "";
          getQtyInput.value = c.getQty || "";
          
          setSelectedValues("buy-categories", c.buyCategories || []);
          updateSubcategoriesField("buy-categories", "buy-subcategories", "buy-sub-wrapper", c.buySubCategories || []);
          
          setSelectedValues("get-categories", c.getCategories || []);
          updateSubcategoriesField("get-categories", "get-subcategories", "get-sub-wrapper", c.getSubCategories || []);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      
      campaignList.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi khi tải danh sách chiến dịch:", err);
  }
}

/* ================= SAVE / UPDATE DATA SUBMIT ================= */
form.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const title = titleInput.value.trim();
    const description = descriptionInput.value; 
    const type = campaignTypeSelect.value;

    if (title.length < 2) return alert("Tiêu đề quá ngắn!");
    if (description.length < 5) return alert("Nội dung mô tả quá ngắn!");
    if (!type) return alert("Vui lòng xác định Loại chiến dịch!");

    let bannerUrl = "";
    if (bannerImageInput.files[0]) bannerUrl = await uploadImage(bannerImageInput.files[0]);

    const campaignData = {
      title: title,
      code: codeInput.value.trim().toUpperCase(),
      type: type,
      description: description,
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      active: true, // Mặc định luôn bật hoạt động khi lưu mới/cập nhật
      updatedAt: new Date()
    };
    if (bannerUrl) campaignData.banner = bannerUrl;

    if (type === "percentage") {
      campaignData.discountPercent = Number(discountPercentSelect.value);
      campaignData.appliedCategories = getSelectedValues("pct-categories");
      campaignData.appliedSubCategories = getSelectedValues("pct-subcategories");
      if (campaignData.discountPercent <= 0) return alert("Vui lòng chọn mức giảm giá phần trăm!");
    } 
    else if (type === "flat_amount") {
      campaignData.discountFlatValue = Number(discountFlatValueInput.value);
      campaignData.appliedCategories = getSelectedValues("flat-categories");
      campaignData.appliedSubCategories = getSelectedValues("flat-subcategories");
      if (campaignData.discountFlatValue <= 0) return alert("Vui lòng điền số tiền giảm trực tiếp!");
    } 
    else if (type === "buy_x_get_y") {
      campaignData.buyQty = Number(buyQtyInput.value);
      campaignData.getQty = Number(getQtyInput.value);
      campaignData.buyCategories = getSelectedValues("buy-categories");
      campaignData.buySubCategories = getSelectedValues("buy-subcategories");
      campaignData.getCategories = getSelectedValues("get-categories");
      campaignData.getSubCategories = getSelectedValues("get-subcategories");
      if (campaignData.buyQty <= 0 || campaignData.getQty <= 0) {
        return alert("Vui lòng nhập đầy đủ số lượng cho cấu hình Mua X tặng Y!");
      }
    }

    if (campaignIdInput.value) {
      await updateDoc(doc(db, "campaigns", campaignIdInput.value), campaignData);
      alert("Cập nhật chiến dịch thành công!");
    } else {
      if (!bannerUrl) return alert("Vui lòng chọn banner!");
      campaignData.banner = bannerUrl;
      campaignData.createdAt = new Date();
      await addDoc(collection(db, "campaigns"), campaignData);
      alert("Thêm chiến dịch mới thành công!");
    }
    
    // Khôi phục form về trạng thái ban đầu sạch sẽ
    form.reset(); 
    campaignIdInput.value = ""; 
    uploadStatus.innerText = ""; 
    clearAllCheckboxes();
    fieldsPercentage.style.display = "none";
    fieldsFlatAmount.style.display = "none";
    fieldsBuyXGetY.style.display = "none";
    
    loadCampaigns();
  } catch (err) { 
    alert(err.message); 
  }
};