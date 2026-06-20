import { db, auth } from "../../../services/firebase.config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  getDoc,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { CLOUDINARY_API } from "../../../services/cloudinary.config.js";

/* ================= DOM ================= */
const form = document.getElementById("news-form");
const newsIdInput = document.getElementById("news-id");
const newsTitleInput = document.getElementById("news-title");
const newsDateInput = document.getElementById("news-date");
const newsContentInput = document.getElementById("news-content");
const newsImageInput = document.getElementById("news-image");
const newsList = document.getElementById("news-list");
const uploadStatus = document.getElementById("upload-status");

/* ================= NAVBAR & DROPDOWN ================= */
const avatarBtn = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

if (avatarBtn && dropdownMenu) {
  avatarBtn.onclick = (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
  };
  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown"))
      dropdownMenu.classList.remove("show");
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

    // Kích hoạt nạp danh sách tin tức sau khi đã kiểm tra quyền hạn hợp lệ
    loadNews();
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

/* ================= CLOUDINARY ================= */
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_API.uploadPreset);
  uploadStatus.innerText = "Đang upload ảnh...";
  
  const response = await fetch(CLOUDINARY_API.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  uploadStatus.innerText = "Upload thành công!";
  return data.secure_url;
}

/* ================= LOAD NEWS ================= */
async function loadNews() {
  if (!newsList) return;
  newsList.innerHTML = "";
  
  try {
    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const news = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${news.image}" class="news-image" style="width:60px; height:40px; object-fit:cover;"></td>
        <td>${news.title}</td>
        <td>${news.date}</td>
        <td>${news.content ? news.content.substring(0, 50) + '...' : ''}</td>
        <td>
          <button class="edit-btn">Sửa</button>
          <button class="delete-btn">Xóa</button>
        </td>
      `;

      // Gắn sự kiện xóa tin tức
      tr.querySelector(".delete-btn").onclick = async () => {
        if (confirm(`Xóa tin tức "${news.title}"?`)) {
          await deleteDoc(doc(db, "news", docSnap.id));
          loadNews();
        }
      };

      // Gắn sự kiện sửa tin tức
      tr.querySelector(".edit-btn").onclick = () => {
        newsIdInput.value = docSnap.id;
        newsTitleInput.value = news.title;
        newsDateInput.value = news.date;
        newsContentInput.value = news.content;
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      
      newsList.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi khi tải danh sách tin tức:", err);
  }
}

/* ================= SAVE NEWS ================= */
form.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const id = newsIdInput.value;
    const title = newsTitleInput.value.trim();
    const content = newsContentInput.value.trim(); // Dữ liệu này giữ nguyên dấu \n

    if (title.length < 2) return alert("Tiêu đề quá ngắn!");
    if (content.length < 5) return alert("Nội dung quá ngắn!");

    let imageUrl = "";
    if (newsImageInput.files[0]) {
      imageUrl = await uploadImage(newsImageInput.files[0]);
    } else if (!id) {
      return alert("Vui lòng chọn ảnh!");
    }

    const newsData = {
      title,
      date: newsDateInput.value,
      content, // Lưu trực tiếp văn bản có xuống dòng
      updatedAt: new Date(),
    };
    if (imageUrl) newsData.image = imageUrl;

    if (id) {
      await updateDoc(doc(db, "news", id), newsData);
      alert("Cập nhật thành công!");
    } else {
      newsData.createdAt = new Date();
      await addDoc(collection(db, "news"), newsData);
      alert("Thêm tin thành công!");
    }

    form.reset();
    newsIdInput.value = "";
    uploadStatus.innerText = "";
    loadNews();
  } catch (err) {
    alert("Có lỗi xảy ra: " + err.message);
  }
};