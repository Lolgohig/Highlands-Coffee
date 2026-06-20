import { db, auth } from "../../../services/firebase.config.js";
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* DOM SELECTORS */
const megaMenu = document.getElementById("megaMenu");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
    initAuthLogic();      // Xử lý Avatar & Logout
    loadMegaMenu();       // Xử lý Menu
    initScrollReveal();   // Xử lý hiệu ứng cuộn
    loadNews();           // Xử lý tin tức
});

/* 1. AUTH & AVATAR LOGIC */
function initAuthLogic() {
    // Logout
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut(auth);
            window.location.href = "auth.html";
        };
    }

    // Avatar & Dropdown
    if (navbarAvatar && dropdownMenu) {
        navbarAvatar.onclick = (e) => { e.stopPropagation(); dropdownMenu.classList.toggle("show"); };
        window.onclick = (e) => { if (!e.target.closest(".profile-dropdown")) dropdownMenu.classList.remove("show"); };
    }

    // Load Avatar từ Firestore
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists() && navbarAvatar) {
                navbarAvatar.src = snap.data().avatar || "https://i.pravatar.cc/150";
            }
        } catch (err) { console.error("Lỗi tải avatar:", err); }
    });
}

/* =======================================================
   LOAD MEGA MENU (PHIÊN BẢN CHUẨN ĐỒNG BỘ CHO MỌI TRANG USER)
======================================================= */
async function loadMegaMenu() {
  const megaMenu = document.getElementById("megaMenu");
  if (!megaMenu) return;
  megaMenu.innerHTML = "";

  // Hàm cục bộ định cấu trúc trọng số thứ tự hiển thị Categories
  function getCategoryWeight(categoryName) {
    const name = (categoryName || "").toLowerCase().trim();
    if (name.includes("cà phê") || name.includes("coffee") || name.includes("phin")) return 1;
    if (name.includes("trà") || name.includes("tea")) return 2;
    if (name.includes("freeze")) return 3;
    return 4; // Bánh mì, bánh ngọt, merch, món khác...
  }

  try {
    const categorySnapshot = await getDocs(collection(db, "categories"));
    const categoriesList = [];

    // 1. Đọc dữ liệu thô từ Firestore vào mảng tạm
    categorySnapshot.forEach((categoryDoc) => {
      const categoryData = categoryDoc.data();
      categoriesList.push({
        id: categoryDoc.id,
        name: categoryData.name || "Tên danh mục",
        subCategories: categoryData.subCategories || [],
        orderWeight: getCategoryWeight(categoryData.name)
      });
    });

    // 2. Sắp xếp danh mục chính theo thứ tự chuẩn Highlands Coffee
    categoriesList.sort((a, b) => a.orderWeight - b.orderWeight);

    // 3. Tiến hành xây dựng cấu trúc HTML và sắp xếp danh mục con
    categoriesList.forEach((category) => {
      const column = document.createElement("div");
      column.className = "mega-column";

      column.innerHTML = `
        <h4>
          <a href="catalog.html?category=${category.id}">
            ${category.name}
          </a>
        </h4>
      `;

      // Copy mảng danh mục con để xử lý sắp xếp theo thời gian khởi tạo (createdAt)
      let subCategoriesArray = [...category.subCategories];
      if (subCategoriesArray.length > 0) {
        subCategoriesArray.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return timeA - timeB; // Cũ tạo trước đứng trước, mới tạo sau đứng sau
        });
      }

      // Vòng lặp kết xuất các đường link danh mục con (tối đa 6 món)
      let subCount = 0;
      subCategoriesArray.forEach((subCat) => {
        if (subCount < 6) {
          const link = document.createElement("a");
          link.className = "mega-sub-category";
          link.href = `catalog.html?subcategory=${subCat.id}`;
          link.textContent = subCat.name;

          column.appendChild(link);
          subCount++;
        }
      });

      megaMenu.appendChild(column);
    });
  } catch (err) {
    console.error("Lỗi đồng bộ cấu trúc Mega Menu hệ thống:", err);
  }
}

/* 3. SCROLL REVEAL */
function initScrollReveal() {
    const reveals = document.querySelectorAll(".scroll-reveal");
    const check = () => {
        reveals.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.classList.add("active");
        });
    };
    window.addEventListener("scroll", check);
    check();
}

/* 4. NEWS-DETAIL LOGIC */
async function loadNews() {
    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');
    if (!newsId) return;

    const today = new Date();

    try {
        // 1. Load tin chi tiết
        const snap = await getDoc(doc(db, "news", newsId));
        if (snap.exists()) {
            const n = snap.data();
            const newsDate = new Date(n.date);

            // Kiểm tra bảo vệ: Nếu tin tức thuộc về tương lai, không hiển thị nội dung
            if (newsDate > today) {
                document.getElementById("news-title").textContent = "Bài viết không tồn tại hoặc chưa được xuất bản";
                document.getElementById("news-date").textContent = "";
                document.getElementById("news-img").style.display = "none";
                document.getElementById("news-body").textContent = "Bài viết này có ngày hẹn đăng ở tương lai nên hiện tại không thể truy cập.";
            } else {
                document.getElementById("news-title").textContent = n.title;
                document.getElementById("news-date").textContent = n.date;
                document.getElementById("news-img").src = n.image;
                document.getElementById("news-body").innerHTML = n.content || "Nội dung đang cập nhật...";
            }
        }

        // 2. Load tin liên quan (chỉ lấy tối đa 10 tin hợp lệ từ hiện tại về quá khứ)
        const q = query(collection(db, "news"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const relatedList = document.getElementById("related-list");
        relatedList.innerHTML = ""; // Xóa nội dung cũ
        
        let addedCount = 0;

        querySnapshot.forEach(docSnap => {
            // Điều kiện: Không trùng với tin đang đọc, không vượt quá 10 tin, và ngày đăng phải <= hôm nay
            if (docSnap.id !== newsId && addedCount < 10) {
                const n = docSnap.data();
                const newsDate = new Date(n.date);

                if (newsDate <= today) {
                    const a = document.createElement("a");
                    a.className = "related-item-text"; // Class cho danh sách text
                    a.href = `news-detail.html?id=${docSnap.id}`;
                    // Cấu trúc: Tiêu đề + (ngày, giờ)
                    a.innerHTML = `<span>▶ ${n.title}</span> <small>(${n.date})</small>`;
                    relatedList.appendChild(a);
                    
                    addedCount++;
                }
            }
        });
    } catch (err) {
        console.error("Lỗi load tin tức chi tiết:", err);
    }
}