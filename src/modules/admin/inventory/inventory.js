import { db, auth } from "../../../services/firebase.config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { CLOUDINARY_API } from "../../../services/cloudinary.config.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM SELECTORS ================= */
const productForm = document.getElementById("product-form");
const productIdInput = document.getElementById("product-id");
const nameInput = document.getElementById("name");
const descriptionInput = document.getElementById("description");
const imageInput = document.getElementById("image-file");
const productList = document.getElementById("product-list");
const uploadStatus = document.getElementById("upload-status");
const categorySelect = document.getElementById("category");
const statusSelect = document.getElementById("status"); 

// DOM Quản lý cơ chế biến đổi trường Giá tiền / Điểm thưởng
const priceInput = document.getElementById("price");
const priceWrapper = document.getElementById("price-wrapper");
const pointsInput = document.getElementById("points");
const pointsWrapper = document.getElementById("points-wrapper");

// DOM Sub-categories 
const subCategorySelect = document.getElementById("sub-category");
const subCategoryWrapper = document.getElementById("sub-category-wrapper");

const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

// Biến lưu trữ cục bộ toàn bộ danh mục để xử lý trích xuất mảng con nhanh gọn
let allCategoriesData = {};

/* ================= DROPDOWN & SECURITY AUTH ================= */
if (avatarBtn && dropdownMenu) {
  avatarBtn.onclick = () => dropdownMenu.classList.toggle("show");
  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown"))
      dropdownMenu.classList.remove("show");
  };
}

// Thực hiện xác thực phân quyền quản trị viên tối cao
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
      console.error("Lỗi khi tải avatar admin:", err);
    }

    // Kích hoạt khởi chạy nạp hệ thống dữ liệu sau khi xác thực hợp lệ
    init();
  } else {
    // Đưa ra thông báo cảnh báo nghiêm trọng nếu truy cập trái phép
    alert("Cảnh báo nguy hiểm: Bạn không có quyền truy cập vào trang quản trị Admin hệ thống!");
    
    // Xóa định danh trạng thái ghi nhớ cũ và đẩy quay lại trang auth
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

/* ================= CATEGORIES LOGIC ================= */
async function loadCategories() {
  categorySelect.innerHTML = `<option value="">-- Chọn danh mục --</option>`;
  allCategoriesData = {}; // Reset bộ nhớ cache

  const snapshot = await getDocs(collection(db, "categories"));
  snapshot.forEach((docSnap) => {
    const category = docSnap.data();
    
    // Lưu thông tin danh mục vào object cục bộ để sử dụng lại cho bộ lọc sub-category
    allCategoriesData[docSnap.id] = category;

    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = category.name;
    option.dataset.name = category.name;
    categorySelect.appendChild(option);
  });
}

// Lắng nghe sự kiện thay đổi danh mục chính để cập nhật danh mục con và biến đổi form Giá/Điểm
categorySelect.onchange = function () {
  const selectedCategoryId = this.value;
  
  // Trả ô chọn danh mục con về trạng thái rỗng mặc định
  subCategorySelect.innerHTML = `<option value="">-- Chọn danh mục con --</option>`;
  
  if (!selectedCategoryId || !allCategoriesData[selectedCategoryId]) {
    subCategorySelect.required = false;
    switchInputForm(false); // Trở về ô nhập giá tiền mặc định
    return;
  }

  const category = allCategoriesData[selectedCategoryId];
  
  // XỬ LÝ BIẾN ĐỔI: Nếu thuộc danh mục dùng điểm thì ẩn ô Giá tiền, hiện ô Điểm thưởng
  if (category.name === "Sản phẩm sử dụng điểm") {
    switchInputForm(true);
  } else {
    switchInputForm(false);
  }

  // Kiểm tra xem danh mục cha này có tồn tại mảng danh mục con không
  if (category.subCategories && category.subCategories.length > 0) {
    category.subCategories.forEach((sub) => {
      const option = document.createElement("option");
      option.value = sub.id;
      option.textContent = sub.name;
      option.dataset.name = sub.name;
      subCategorySelect.appendChild(option);
    });
    subCategorySelect.required = true; // Bắt buộc nhập nếu có danh mục con tồn tại
  } else {
    subCategorySelect.required = false;
  }
};

// Hàm bổ trợ ẩn/hiện và bật/tắt thuộc tính 'required' để không bị lỗi Form Validation
function switchInputForm(isPointsCategory) {
  if (isPointsCategory) {
    pointsWrapper.style.display = "flex";
    pointsInput.required = true;
    
    priceWrapper.style.display = "none";
    priceInput.required = false;
    priceInput.value = ""; // Xóa dữ liệu cũ để tránh nhầm lẫn dữ liệu
  } else {
    priceWrapper.style.display = "flex";
    priceInput.required = true;
    
    pointsWrapper.style.display = "none";
    pointsInput.required = false;
    pointsInput.value = ""; // Xóa dữ liệu cũ
  }
}

/* ================= CLOUDINARY UPLOAD ================= */
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_API.uploadPreset);
  uploadStatus.innerText = "Đang upload...";
  const res = await fetch(CLOUDINARY_API.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  uploadStatus.innerText = "Upload thành công!";
  return data.secure_url;
}

/* ================= PRODUCTS LOGIC ================= */
async function loadProducts() {
  if (!productList) return;
  productList.innerHTML = "";
  
  const todayStr = new Date().toLocaleDateString("sv-SE"); // Định dạng chuẩn 'YYYY-MM-DD'
  const snapshot = await getDocs(collection(db, "products"));
  
  // Khởi tạo mảng lưu trữ cục bộ sản phẩm để tiến hành phân nhóm sắp xếp
  let productsArray = [];
  
  for (const docSnap of snapshot.docs) {
    let product = docSnap.data();
    const productId = docSnap.id;
    
    /* MECHANISM: TỰ ĐỘNG KHÔI PHỤC TRẠNG THÁI "CÒN HÀNG" KHI SANG NGÀY MỚI */
    if (product.lastResetDate !== todayStr) {
      try {
        const resetData = {
          status: "in-stock",
          lastResetDate: todayStr
        };
        await updateDoc(doc(db, "products", productId), resetData);
        
        product.status = "in-stock";
        product.lastResetDate = todayStr;
        console.log(`Đã tự động reset trạng thái 'Còn hàng' cho sản phẩm: ${product.name}`);
      } catch (resetErr) {
        console.error("Lỗi đồng bộ tự động reset ngày mới:", resetErr);
      }
    }

    product.id = productId;
    productsArray.push(product);
  }

  /* ================= THUẬT TOÁN SẮP XẾP SẢN PHẨM PHÍA ADMIN ================= */
  productsArray.sort((a, b) => {
    // 1. Nhóm theo Danh mục chính trước
    const catA = a.categoryName || "";
    const catB = b.categoryName || "";
    if (catA !== catB) return catA.localeCompare(catB, "vi");

    // 2. Nhóm theo Danh mục con
    const subA = a.subCategoryName || "";
    const subB = b.subCategoryName || "";
    if (subA !== subB) return subA.localeCompare(subB, "vi");

    // 3. Trong cùng một nhóm, sắp xếp tăng dần theo giá trị thanh toán (Điểm hoặc Tiền mặt)
    if (a.categoryName === "Sản phẩm sử dụng điểm" || b.categoryName === "Sản phẩm sử dụng điểm") {
      return (a.pointsRequired || 0) - (b.pointsRequired || 0);
    }
    return (a.price || 0) - (b.price || 0);
  });

  // Tiến hành xuất giao diện dòng dựa trên mảng đã được phân loại thứ tự tăng dần
  productsArray.forEach((product) => {
    const tr = document.createElement("tr");
    
    const displaySubName = product.subCategoryName || `<span style="color:#aaa; font-style:italic;">Không có</span>`;

    let priceColumnDisplay = "";
    if (product.categoryName === "Sản phẩm sử dụng điểm" || product.pointsRequired > 0) {
      priceColumnDisplay = `<span class="category-points-badge">${(product.pointsRequired || 0).toLocaleString("vi-VN")} Điểm</span>`;
    } else {
      priceColumnDisplay = `<span style="color:#7b001f; font-weight:600;">${Number(product.price || 0).toLocaleString("vi-VN")} VNĐ</span>`;
    }

    let statusBadgeHTML = "";
    if (product.status === "out-of-stock") {
      statusBadgeHTML = `<span class="status-badge status-out">Hết hàng</span>`;
    } else {
      statusBadgeHTML = `<span class="status-badge status-in">Còn hàng</span>`;
    }

    tr.innerHTML = `
      <td><img src="${product.image || 'https://via.placeholder.com/60'}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;"></td>
      <td><strong>${product.name}</strong></td>
      <td>${priceColumnDisplay}</td>
      <td><span class="category-main-badge">${product.categoryName || ""}</span></td>
      <td><span class="category-sub-badge">${displaySubName}</span></td>
      <td>${statusBadgeHTML}</td>
      <td class="description-cell">${product.description || ""}</td>
      <td>
        <button class="edit-btn">Sửa</button>
        <button class="delete-btn">Xóa</button>
      </td>
    `;
    
    // EVENT: XÓA SẢN PHẨM
    tr.querySelector(".delete-btn").onclick = async () => {
      if (confirm(`Xóa sản phẩm "${product.name}" khỏi hệ thống?`)) {
        await deleteDoc(doc(db, "products", product.id));
        loadProducts();
      }
    };
    
    // EVENT: SỬA SẢN PHẨM
    tr.querySelector(".edit-btn").onclick = async () => {
      productIdInput.value = product.id;
      nameInput.value = product.name;
      descriptionInput.value = product.description; 
      statusSelect.value = product.status || "in-stock";
      
      categorySelect.value = product.categoryId;
      categorySelect.dispatchEvent(new Event('change'));
      
      if (product.categoryName === "Sản phẩm sử dụng điểm") {
        pointsInput.value = product.pointsRequired || "";
      } else {
        priceInput.value = product.price || "";
      }
      
      if (product.subCategoryId) {
        subCategorySelect.value = product.subCategoryId;
      } else {
        subCategorySelect.value = "";
      }
      
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    
    productList.appendChild(tr);
  });
}

/* ================= SAVE / UPDATE DATA SUBMIT ================= */
productForm.onsubmit = async (e) => {
  e.preventDefault();
  try {
    let imageUrl = "";
    if (imageInput.files[0]) imageUrl = await uploadImage(imageInput.files[0]);
    
    const selectedSubOption = subCategorySelect.options[subCategorySelect.selectedIndex];
    const categoryName = categorySelect.options[categorySelect.selectedIndex].dataset.name;

    const name = nameInput.value.trim();
    const description = descriptionInput.value; 

    if (name.length < 2) return alert("Tên sản phẩm quá ngắn!");
    if (description.length < 5) return alert("Mô tả sản phẩm quá ngắn!");

    const todayStr = new Date().toLocaleDateString("sv-SE");

    const productData = {
      name: name,
      description: description, 
      categoryId: categorySelect.value,
      categoryName: categoryName,
      subCategoryId: subCategorySelect.value || "", 
      subCategoryName: (subCategorySelect.value && selectedSubOption) ? selectedSubOption.dataset.name : "",
      status: statusSelect.value,
      lastResetDate: todayStr,
      updatedAt: new Date(),
    };
    
    if (categoryName === "Sản phẩm sử dụng điểm") {
      productData.pointsRequired = Number(pointsInput.value);
      productData.price = 0;
    } else {
      productData.price = Number(priceInput.value);
      productData.pointsRequired = 0;
    }

    if (imageUrl) productData.image = imageUrl;

    if (productIdInput.value) {
      await updateDoc(doc(db, "products", productIdInput.value), productData);
      alert("Cập nhật thông tin sản phẩm thành công!");
    } else {
      if(!imageUrl) {
         alert("Vui lòng bổ sung hình ảnh minh họa cho sản phẩm mới!");
         return;
      }
      productData.createdAt = new Date();
      await addDoc(collection(db, "products"), productData);
      alert("Thêm sản phẩm mới vào kho thành công!");
    }
    
    productForm.reset();
    productIdInput.value = "";
    uploadStatus.innerText = "";
    subCategorySelect.innerHTML = `<option value="">-- Chọn danh mục con --</option>`;
    subCategorySelect.required = false;
    statusSelect.value = "in-stock";
    switchInputForm(false);

    loadProducts();
  } catch (err) {
    console.error(err);
    alert("Hệ thống phát sinh lỗi: " + err.message);
  }
};

/* ================= INITIALIZATION ================= */
async function init() {
  await loadCategories();
  await loadProducts();
}