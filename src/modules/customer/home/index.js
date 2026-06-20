import {
  db,
  auth
} from "../../../services/firebase.config.js";

import {
  collection,
  getDocs,
  query,
  limit,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* =======================================================
   DOM
======================================================= */

const megaMenu =
  document.getElementById("megaMenu");

const featuredMenu =
  document.getElementById("featuredMenu");

const navbarAvatar =
  document.getElementById("navbarAvatar");

const dropdownMenu =
  document.getElementById("dropdownMenu");

const logoutBtn =
  document.getElementById("logoutBtn");

/* =======================================================
   DROPDOWN
======================================================= */

if (navbarAvatar && dropdownMenu) {

  navbarAvatar.onclick = () => {

    dropdownMenu.classList.toggle(
      "show"
    );
  };

  window.onclick = (e) => {

    if (
      !e.target.closest(
        ".profile-dropdown"
      )
    ) {

      dropdownMenu.classList.remove(
        "show"
      );
    }
  };
}

/* =======================================================
   LOAD AVATAR
======================================================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  try {

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!snap.exists()) return;

    const data = snap.data();

    navbarAvatar.src =
      data.avatar ||
      "https://i.pravatar.cc/150";

  } catch (err) {

    console.error(err);
  }
});

/* =======================================================
   LOGOUT
======================================================= */

if (logoutBtn) {

  logoutBtn.onclick = async () => {

    try {

      await signOut(auth);

      window.location.href =
        "auth.html";

    } catch (err) {

      console.error(err);

      alert(err.message);
    }
  };
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
/* =======================================================
   FEATURED PRODUCTS
======================================================= */

async function loadFeaturedProducts() {

  featuredMenu.innerHTML = "";

  try {

    const q = query(
      collection(db, "products"),
      limit(6)
    );

    const snapshot =
      await getDocs(q);

    snapshot.forEach((docSnap) => {

      const product =
        docSnap.data();

      const finalPrice =
        product.discountPercent
          ? product.price -
            (
              product.price *
              product.discountPercent
            ) / 100
          : product.price;

      const card =
        document.createElement("div");

      card.className =
        "menu-card";

      card.innerHTML = `

        <img
          src="${product.image}"
          alt="${product.name}"
        >

        <div class="menu-content">

          <h3>
            ${product.name}
          </h3>

          <p>
            ${
              product.description ||
              "Highlands Coffee"
            }
          </p>

          <div class="menu-bottom">

            <div>

              ${
                product.discountPercent
                  ? `
                    <div class="old-price">
                      ${Number(product.price)
                        .toLocaleString("vi-VN")}đ
                    </div>

                    <div class="sale-price">
                      ${Number(finalPrice)
                        .toLocaleString("vi-VN")}đ
                    </div>
                  `
                  : `
                    <div class="price">
                      ${Number(product.price)
                        .toLocaleString("vi-VN")}đ
                    </div>
                  `
              }

            </div>

            <a
              href="product.html?id=${docSnap.id}"
              class="order-btn"
            >
              Đặt ngay
            </a>

          </div>

        </div>
      `;

      featuredMenu.appendChild(card);
    });

  } catch (err) {

    console.error(err);
  }
}

/* =======================================================
   INIT
======================================================= */

loadMegaMenu();

loadFeaturedProducts();