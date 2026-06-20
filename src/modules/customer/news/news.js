import { db, auth } from "../../../services/firebase.config.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* DOM SELECTORS */
const megaMenu = document.getElementById("megaMenu");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");
const newsList = document.getElementById("news-list");

/* STATE MANAGEMENT */
let allNews = [];
let displayedCount = 0;
const ITEMS_PER_PAGE = 9;

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
    initAuthLogic();
    loadMegaMenu();
    loadNews();
});

/* 1. AUTH & AVATAR LOGIC */
function initAuthLogic() {
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut(auth);
            window.location.href = "auth.html";
        };
    }

    if (navbarAvatar && dropdownMenu) {
        navbarAvatar.onclick = (e) => { e.stopPropagation(); dropdownMenu.classList.toggle("show"); };
        window.onclick = (e) => { if (!e.target.closest(".profile-dropdown")) dropdownMenu.classList.remove("show"); };
    }

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

/* 3. NEWS LOGIC (FILTER & PAGINATION) */
async function loadNews() {
    if (!newsList) return;

    try {
        const snapshot = await getDocs(collection(db, "news"));
        const today = new Date();
        allNews = [];

        snapshot.forEach(docSnap => {
            const n = docSnap.data();
            const newsDate = new Date(n.date);
            // Lọc: Chỉ lấy tin có ngày <= hôm nay
            if (newsDate <= today) {
                allNews.push({ id: docSnap.id, ...n });
            }
        });

        // Sắp xếp ngày mới nhất lên đầu
        allNews.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        renderNews();
    } catch (err) { console.error("Lỗi load tin tức:", err); }
}

function renderNews() {
    const nextBatch = allNews.slice(displayedCount, displayedCount + ITEMS_PER_PAGE);
    
    nextBatch.forEach(n => {
        const card = document.createElement("a");
        card.className = "news-card scroll-reveal";
        card.href = `news-detail.html?id=${n.id}`;
        card.innerHTML = `
            <div class="img-wrapper">
                <img src="${n.image || 'https://via.placeholder.com/250'}" alt="${n.title}">
            </div>
            <h3>${n.title}</h3>
            <p>${n.date}</p>
        `;
        newsList.appendChild(card);
    });

    displayedCount += nextBatch.length;
    initScrollReveal();

    // Nút Xem thêm
    let btn = document.getElementById("load-more-btn");
    if (displayedCount < allNews.length) {
        if (!btn) {
            btn = document.createElement("button");
            btn.id = "load-more-btn";
            btn.className = "load-more-btn";
            btn.textContent = "XEM THÊM";
            btn.onclick = renderNews;
            newsList.parentElement.appendChild(btn);
        }
    } else if (btn) {
        btn.remove();
    }
}

/* 4. SCROLL REVEAL */
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