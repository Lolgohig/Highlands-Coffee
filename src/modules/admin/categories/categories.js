import { db, auth } from "../../../services/firebase.config.js";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { CLOUDINARY_API } from "../../../services/cloudinary.config.js";

/* ================= DOM SELECTORS ================= */
const form = document.getElementById("category-form");
const categoryIdInput = document.getElementById("category-id");
const categoryNameInput = document.getElementById("category-name");
const categoryDescriptionInput = document.getElementById("category-description");
const categoryImageInput = document.getElementById("category-image");
const categoryList = document.getElementById("category-list");
const uploadStatus = document.getElementById("upload-status");

// DOM Quản lý Sub-categories
const subCategoryInput = document.getElementById("sub-category-input");
const subCategoryImageInput = document.getElementById("sub-category-image");
const subFileNamePreview = document.getElementById("sub-file-name-preview");
const addSubBtn = document.getElementById("add-sub-btn");
const subCategoryTagsContainer = document.getElementById("sub-category-tags");
const quickChangeSubImage = document.getElementById("quick-change-sub-image");

// DOM Navbar
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* ================= STATE MANAGEMENT ================= */
let temporarySubCategories = []; // [{ id, name, image, createdAt }]
let currentEditingSubId = null;  // Lưu ID của sub-category đang được bấm chọn đổi ảnh nhanh

/* ================= NAVBAR DROPDOWN & SECURITY AUTH ================= */
if (avatarBtn && dropdownMenu) {
  avatarBtn.onclick = () => { dropdownMenu.classList.toggle("show"); };
  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown")) dropdownMenu.classList.remove("show");
  };
}

onAuthStateChanged(auth, async (user) => {
  if (user && user.email === "tranvominhluan8@gmail.com") {
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && avatarBtn) {
        avatarBtn.src = userSnap.data().avatar || "https://i.pravatar.cc/100";
      }
    } catch (err) { 
      console.error("Lỗi khi tải avatar admin:", err); 
    }
    loadCategories();
  } else {
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
    localStorage.removeItem("rememberUser");
    window.location.href = "auth.html";
  }
});

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

/* ================= HÀM UPLOAD ẢNH CHUNG LÊN CLOUDINARY ================= */
async function uploadToCloudinary(file, statusElement) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_API.uploadPreset);

  if (statusElement) statusElement.innerText = "Đang xử lý tải ảnh...";
  
  const response = await fetch(CLOUDINARY_API.uploadUrl, { method: "POST", body: formData });
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);
  if (statusElement) statusElement.innerText = "Tải ảnh hoàn tất!";
  return data.secure_url;
}

/* ================= THEO DÕI CHỌN FILE SUB-CATEGORY BAN ĐẦU ================= */
if (subCategoryImageInput) {
  subCategoryImageInput.onchange = (e) => {
    const file = e.target.files[0];
    subFileNamePreview.innerText = file ? file.name : "Chưa chọn ảnh";
  };
}

/* ================= XỬ LÝ EVENT THÊM MỚI SUB-CATEGORY ================= */
addSubBtn.onclick = async () => {
  const subName = subCategoryInput.value.trim();
  if (!subName) {
    alert("Vui lòng điền tên danh mục con trước!");
    return;
  }

  const subFile = subCategoryImageInput.files[0];
  if (!subFile) {
    alert("Bắt buộc phải chọn ảnh minh họa riêng cho danh mục con này!");
    return;
  }

  try {
    addSubBtn.disabled = true;
    addSubBtn.innerText = "Đang tạo...";

    const subImageUrl = await uploadToCloudinary(subFile, null);

    const newSubCategory = {
      id: "sub_" + Date.now() + Math.random().toString(36).substr(2, 5),
      name: subName,
      image: subImageUrl,
      createdAt: new Date().toISOString()
    };

    temporarySubCategories.push(newSubCategory);
    renderSubCategoryTags();

    subCategoryInput.value = "";
    subCategoryImageInput.value = "";
    subFileNamePreview.innerText = "Chưa chọn ảnh";
    subCategoryInput.focus();

  } catch (error) {
    console.error("Lỗi thêm sub-category:", error);
    alert("Không thể upload ảnh danh mục con: " + error.message);
  } finally {
    addSubBtn.disabled = false;
    addSubBtn.innerText = "Thêm Sub-Category";
  }
};

/* ================= CHỨC NĂNG MỚI: CLICK VÀO SUB ĐỂ CHỌN ĐỔI ẢNH NHANH ================= */
function renderSubCategoryTags() {
  subCategoryTagsContainer.innerHTML = "";
  
  temporarySubCategories.forEach((sub) => {
    const card = document.createElement("div");
    card.className = "sub-category-preview-card";
    card.setAttribute("title", "Click vào ảnh hoặc thẻ để thay đổi hình ảnh");
    
    card.innerHTML = `
      <div class="sub-card-click-area" data-id="${sub.id}">
        <img src="${sub.image || 'https://via.placeholder.com/40'}" class="sub-card-img">
        <div class="sub-card-info">
          <span class="sub-card-name">${sub.name}</span>
          <span class="sub-card-hint">Thay ảnh</span>
        </div>
      </div>
      <button type="button" class="sub-card-delete-btn" data-id="${sub.id}">&times;</button>
    `;
    
    // Bắt sự kiện click vào vùng thông tin để chọn ảnh mới
    card.querySelector(".sub-card-click-area").onclick = (e) => {
      const subId = e.currentTarget.dataset.id;
      currentEditingSubId = subId; // Ghi nhận đang đổi ảnh cho sub-category nào
      quickChangeSubImage.click(); // Kích hoạt mở hộp thoại chọn file của trình duyệt
    };
    
    // Sự kiện nút xóa
    card.querySelector(".sub-card-delete-btn").onclick = (e) => {
      e.stopPropagation();
      const targetId = e.target.dataset.id;
      temporarySubCategories = temporarySubCategories.filter(item => item.id !== targetId);
      renderSubCategoryTags();
    };
    
    subCategoryTagsContainer.appendChild(card);
  });
}

// Lắng nghe sự kiện sau khi người dùng chọn xong file ảnh mới cho Sub-category cụ thể
quickChangeSubImage.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file || !currentEditingSubId) return;

  try {
    uploadStatus.innerText = "Đang cập nhật ảnh riêng cho danh mục con...";
    
    // Tải ảnh mới lên Cloudinary
    const newImageUrl = await uploadToCloudinary(file, null);
    
    // Khớp ID và cập nhật lại đường link ảnh trong mảng tạm thời
    temporarySubCategories = temporarySubCategories.map(item => {
      if (item.id === currentEditingSubId) {
        return { ...item, image: newImageUrl };
      }
      return item;
    });

    // Vẽ lại giao diện danh sách tag con để cập nhật ảnh mới ngay lập tức
    renderSubCategoryTags();
    uploadStatus.innerText = "Đã đổi ảnh danh mục con thành công!";
    
  } catch (error) {
    console.error(error);
    alert("Lỗi khi thay đổi ảnh danh mục con: " + error.message);
  } finally {
    quickChangeSubImage.value = ""; // Làm trống input file để có thể chọn lại lần sau
    currentEditingSubId = null;
  }
};

/* ================= ĐỔ DỮ LIỆU DANH MỤC RA BẢNG QUẢN TRỊ ================= */
async function loadCategories() {
  if (!categoryList) return;
  categoryList.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "categories"));

    for (const docSnap of snapshot.docs) {
      const category = docSnap.data();

      const productsQuery = query(collection(db, "products"), where("categoryId", "==", docSnap.id));
      const productsSnapshot = await getDocs(productsQuery);
      const productCount = productsSnapshot.size;

      let subCategoriesHtml = "";
      if (category.subCategories && category.subCategories.length > 0) {
        subCategoriesHtml = category.subCategories.map(sub => `
          <div class="table-sub-item-chip">
            <img src="${sub.image || 'https://via.placeholder.com/30'}" class="table-sub-thumb">
            <span>${sub.name}</span>
          </div>
        `).join("");
      } else {
        subCategoriesHtml = `<span class="table-sub-empty">Không có danh mục con</span>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${category.image || 'https://via.placeholder.com/80'}" class="category-image"></td>
        <td><strong>${category.name}</strong></td>
        <td>${category.description || ""}</td>
        <td><div class="table-subs-flex-wrapper">${subCategoriesHtml}</div></td>
        <td><span class="product-count-badge">${productCount}</span> sản phẩm</td>
        <td>
          <button class="edit-btn">Sửa</button>
          <button class="delete-btn">Xóa</button>
        </td>
      `;

      tr.querySelector(".delete-btn").onclick = async () => {
        if (!confirm(`Xóa danh mục chính "${category.name}"? Cấu trúc danh mục con bên trong sẽ mất.`)) return;
        await deleteDoc(doc(db, "categories", docSnap.id));
        loadCategories();
      };

      tr.querySelector(".edit-btn").onclick = () => {
        categoryIdInput.value = docSnap.id;
        categoryNameInput.value = category.name;
        categoryDescriptionInput.value = category.description; // Nhận lại nguyên vẹn text chứa ký tự xuống dòng lên textarea
        
        temporarySubCategories = category.subCategories ? [...category.subCategories] : [];
        renderSubCategoryTags();

        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      categoryList.appendChild(tr);
    }
  } catch (err) {
    console.error("Lỗi khi tải danh mục sản phẩm:", err);
  }
}

/* ================= LƯU DATA CHÍNH (SUBMIT FORM) ================= */
form.onsubmit = async (e) => {
  e.preventDefault();

  try {
    const id = categoryIdInput.value;
    const name = categoryNameInput.value.trim();
    const description = categoryDescriptionInput.value; // Đồng bộ loại bỏ .trim() để bảo lưu dấu xuống dòng \n và khoảng trống đầu dòng của admin

    if (name.length < 2) { alert("Tên category phải trên 2 ký tự"); return; }
    if (description.length < 5) { alert("Mô tả phải trên 5 ký tự"); return; }

    let mainImageUrl = "";
    if (categoryImageInput.files[0]) {
      mainImageUrl = await uploadToCloudinary(categoryImageInput.files[0], uploadStatus);
    }

    const categoryData = {
      name: name,
      description: description, // Gửi trực tiếp cấu trúc văn bản gốc vào Firestore
      subCategories: temporarySubCategories,
      updatedAt: new Date()
    };

    if (mainImageUrl) {
      categoryData.image = mainImageUrl;
    }

    if (id) {
      await updateDoc(doc(db, "categories", id), categoryData);
      alert("Cập nhật danh mục thành công!");
    } else {
      if (!mainImageUrl) { alert("Vui lòng lựa chọn hình ảnh cho danh mục chính!"); return; }
      categoryData.image = mainImageUrl;
      categoryData.createdAt = new Date();

      await addDoc(collection(db, "categories"), categoryData);
      alert("Thêm danh mục mới thành công!");
    }

    form.reset();
    categoryIdInput.value = "";
    temporarySubCategories = [];
    subCategoryTagsContainer.innerHTML = "";
    uploadStatus.innerText = "";
    subFileNamePreview.innerText = "Chưa chọn ảnh";
    
    loadCategories();

  } catch (err) {
    console.error(err);
    alert("Có lỗi phát sinh trong hệ thống: " + err.message);
  }
};