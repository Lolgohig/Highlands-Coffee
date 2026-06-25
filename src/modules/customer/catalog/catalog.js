import { db, auth } from "../../../services/firebase.config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* DOM SELECTORS */
const megaMenu = document.getElementById("megaMenu");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");
const appRoot = document.getElementById("catalog-app-root");

/* TRẠNG THÁI TOÀN CỤC BỘ ĐỆM ĐIỀU HƯỚNG SẢN PHẨM SLIDE */
let sliderStates = {};

/* INIT BLOCK */
document.addEventListener("DOMContentLoaded", () => {
    initAuthLogic();      // Xử lý Avatar & Logout đồng bộ
    loadMegaMenu();       // Xử lý nạp cấu trúc thực đơn Mega Menu
    initScrollReveal();   // Xử lý kích hoạt hiệu ứng cuộn mượt
    loadNews();           // Xử lý tích hợp tin tức nền
    routerNavCatalog();   // Điều hướng bóc tách tham số URL xử lý kết xuất giao diện chính
});

/* ================= 1. AUTH & AVATAR LOGIC ================= */
function initAuthLogic() {
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut(auth);
            window.location.href = "auth.html";
        };
    }

    if (navbarAvatar && dropdownMenu) {
        navbarAvatar.onclick = (e) => { 
            e.stopPropagation(); 
            dropdownMenu.classList.toggle("show"); 
        };
        window.onclick = (e) => { 
            if (!e.target.closest(".profile-dropdown")) dropdownMenu.classList.remove("show"); 
        };
    }

    onAuthStateChanged(auth, async (user) => {
        // 1. CHẶN NẾU CHƯA ĐĂNG NHẬP: Nếu không tồn tại user, đá ngay về trang auth.html
        if (!user) {
            window.location.href = "auth.html";
            return;
        }

        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (!snap.exists()) {
                // Phòng trường hợp user có bên Authentication nhưng bị xóa/không có bản ghi trong Firestore
                window.location.href = "auth.html";
                return;
            }

            const userData = snap.data();

            // 2. PHÂN QUYỀN ĐỒNG BỘ: Chỉ cho phép tài khoản có role là "user" ở lại trang này
            if (userData.role !== "user") {
                window.location.href = "auth.html";
                return;
            }

            // 3. HIỂN THỊ AVATAR NẾU ĐỦ ĐIỀU KIỆN
            if (navbarAvatar) {
                navbarAvatar.src = userData.avatar || "https://i.pravatar.cc/150";
            }
            
        } catch (err) { 
            console.error("Lỗi tải thông tin xác thực hệ thống:", err); 
        }
    });
}

/* ================= 2. LOAD MEGA MENU ================= */
async function loadMegaMenu() {
    if (!megaMenu) return;
    megaMenu.innerHTML = "";

    function getCategoryWeight(categoryName) {
        const name = (categoryName || "").toLowerCase().trim();
        if (name.includes("cà phê") || name.includes("coffee") || name.includes("phin")) return 1;
        if (name.includes("trà") || name.includes("tea")) return 2;
        if (name.includes("freeze")) return 3;
        return 4;
    }

    try {
        const categorySnapshot = await getDocs(collection(db, "categories"));
        const categoriesList = [];

        categorySnapshot.forEach((categoryDoc) => {
            const categoryData = categoryDoc.data();
            categoriesList.push({
                id: categoryDoc.id,
                name: categoryData.name || "Tên danh mục",
                subCategories: categoryData.subCategories || [],
                orderWeight: getCategoryWeight(categoryData.name)
            });
        });

        categoriesList.sort((a, b) => a.orderWeight - b.orderWeight);

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

            let subCategoriesArray = [...category.subCategories];
            if (subCategoriesArray.length > 0) {
                subCategoriesArray.sort((a, b) => {
                    const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
                    const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
                    return timeA - timeB;
                });
            }

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

/* ================= 3. SCROLL REVEAL ================= */
function initScrollReveal() {
    const check = () => {
        const reveals = document.querySelectorAll(".scroll-reveal");
        reveals.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.classList.add("active");
        });
    };
    window.addEventListener("scroll", check);
    check();
}

/* ================= 4. LOAD NEWS ================= */
function loadNews() {
    console.log("Hệ thống tin tức tích hợp hoàn tất.");
}

/* ================= HÀM TRỢ GIÚP KIỂM TRA PHÂN LOẠI ĐỔI ĐIỂM ================= */
function checkIsPointsCategory(item, parentCatName = "", parentCatId = "") {
    const catName = (item.categoryName || parentCatName || "").toLowerCase();
    const subName = (item.subCategoryName || "").toLowerCase();
    const catId = item.categoryId || parentCatId || "";

    return catName.includes("sản phẩm sử dụng điểm") || 
           subName.includes("sản phẩm sử dụng điểm") || 
           catId === "points-category";
}

/* ================= 5. ĐIỀU HƯỚNG CATALOG PHÂN CHIA LAYOUT THEO DANH MỤC ================= */
async function routerNavCatalog() {
    if (!appRoot) return;
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get("category");
    const subcategoryId = urlParams.get("subcategory");

    try {
        if (subcategoryId) {
            const parentCat = await findCategoryBySubId(subcategoryId);
            if (parentCat) {
                await renderSubCategoriesDetailedPage(parentCat, subcategoryId);
                initScrollReveal();
                return;
            }
        }

        if (categoryId) {
            const catDoc = await getDoc(doc(db, "categories", categoryId));
            if (catDoc.exists()) {
                const catData = catDoc.data();
                const hasSub = catData.subCategories && catData.subCategories.length > 0;
                
                if (hasSub) {
                    await renderSubCategoriesOverviewPage(categoryId, catData);
                } else {
                    await renderNoSubCategoryDetailedPage(categoryId, catData);
                }
                initScrollReveal();
                return;
            }
        }

        // Trường hợp mặc định nếu không có tham số: Lấy danh mục đầu tiên
        const defaultSnapshot = await getDocs(collection(db, "categories"));
        if (!defaultSnapshot.empty) {
            const firstDoc = defaultSnapshot.docs[0];
            const data = firstDoc.data();
            if (data.subCategories && data.subCategories.length > 0) {
                await renderSubCategoriesOverviewPage(firstDoc.id, data);
            } else {
                await renderNoSubCategoryDetailedPage(firstDoc.id, data);
            }
            initScrollReveal();
        } else {
            appRoot.innerHTML = `<div class="table-sub-empty">Không tìm thấy dữ liệu danh mục thực đơn.</div>`;
        }
    } catch (error) {
        console.error("Lỗi định tuyến trang catalog:", error);
        appRoot.innerHTML = `<div class="table-sub-empty">Lỗi kết nối dữ liệu hệ thống.</div>`;
    }
}

async function findCategoryBySubId(subId) {
    const snapshot = await getDocs(collection(db, "categories"));
    for (let docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.subCategories && data.subCategories.some(s => s.id === subId)) {
            return { id: docSnap.id, ...data };
        }
    }
    return null;
}

/* ================= A. GIAO DIỆN TỔNG QUAN CHO CÓ SUB-CATEGORIES ================= */
async function renderSubCategoriesOverviewPage(categoryId, categoryData) {
    const blocksHtml = await buildSubOverviewBlocks(categoryData.subCategories, categoryId, categoryData.name);
    appRoot.innerHTML = `
        <div class="overview-layout scroll-reveal">
            <div class="category-hero-banner" style="background-image: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.4)), url('${categoryData.image || ''}')">
                <h1 class="hero-title">${categoryData.name}</h1>
                <p class="hero-desc">${categoryData.description || ''}</p>
            </div>
            
            <div class="sub-overview-list-wrapper">
                ${blocksHtml}
            </div>

            <div class="other-categories-showcase">
                <h3 class="showcase-section-title">Khám phá các danh mục khác</h3>
                <div class="showcase-grid-flex" id="other-cats-injection-point"></div>
            </div>
        </div>
    `;
    injectOtherCategoriesShowcase(categoryId);
}

async function buildSubOverviewBlocks(subCategories, parentId, parentName) {
    let htmlResult = "";
    const sortedSubs = [...subCategories].sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    for (let sub of sortedSubs) {
        let pQuery = query(collection(db, "products"), where("subCategory", "==", sub.id), limit(2));
        let pSnap = await getDocs(pQuery);
        
        if (pSnap.empty) {
            pQuery = query(collection(db, "products"), where("subCategoryId", "==", sub.id), limit(2));
            pSnap = await getDocs(pQuery);
        }
        
        let productsHtml = "";
        if (!pSnap.empty) {
            pSnap.forEach(pDoc => {
                const p = pDoc.data();
                
                // ĐÃ ĐIỀU CHỈNH: Kiểm tra luồng hiển thị Giá hoặc Điểm
                const isPoints = checkIsPointsCategory(p, parentName, parentId);
                const displayPrice = isPoints 
                    ? `${(p.pointsRequired || 0).toLocaleString('vi-VN')} Điểm`
                    : `${Number(p.price || 0).toLocaleString('vi-VN')} đ`;

                productsHtml += `
                    <div class="mini-product-item-card" onclick="window.location.href='product.html?id=${pDoc.id}'">
                        <img src="${p.image || ''}" class="mini-p-img" alt="${p.name}">
                        <h5 class="mini-p-name">${p.name}</h5>
                        <p class="mini-p-price ${isPoints ? 'points-style' : ''}">${displayPrice}</p>
                    </div>
                `;
            });
        } else {
            productsHtml = `<p class="table-sub-empty">Sản phẩm sắp ra mắt...</p>`;
        }

        htmlResult += `
            <div class="sub-overview-row-block">
                <div class="sub-block-left-banner">
                    <div class="sub-banner-zoom-box" onclick="window.location.href='catalog.html?subcategory=${sub.id}'">
                        <img src="${sub.image || ''}" class="sub-cover-image">
                    </div>
                    <div class="sub-banner-info-pane">
                        <h3 class="sub-banner-title-link" onclick="window.location.href='catalog.html?subcategory=${sub.id}'">${sub.name}</h3>
                        <a href="catalog.html?subcategory=${sub.id}" class="view-products-action-btn">Xem sản phẩm</a>
                    </div>
                </div>
                <div class="sub-block-right-products">
                    <div class="mini-products-row-flex">
                        ${productsHtml}
                    </div>
                </div>
            </div>
        `;
    }
    return htmlResult;
}

/* ================= B. GIAO DIỆN CHI TIẾT CÓ SUB-CATEGORIES ĐƯỢC CHỌN ================= */
async function renderSubCategoriesDetailedPage(parentCategory, highlightSubId) {
    const orderedSubs = [...parentCategory.subCategories].sort((a, b) => {
        if (a.id === highlightSubId) return -1;
        if (b.id === highlightSubId) return 1;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    const slidersHtml = await buildDetailedSubSliders(orderedSubs, parentCategory.name, parentCategory.id);

    appRoot.innerHTML = `
        <div class="detailed-layout scroll-reveal">
            <div class="breadcrumb-nav-bar">
                <a href="catalog.html?category=${parentCategory.id}" class="back-link-node">← Quay lại danh mục ${parentCategory.name}</a>
            </div>
            <div class="detailed-sliders-stack">
                ${slidersHtml}
            </div>
        </div>
    `;
    attachSliderButtonEvents();
}

async function buildDetailedSubSliders(subsList, parentName, parentId) {
    let htmlResult = "";
    for (let sub of subsList) {
        let pQuery = query(collection(db, "products"), where("subCategory", "==", sub.id));
        let pSnap = await getDocs(pQuery);
        
        if (pSnap.empty) {
            pQuery = query(collection(db, "products"), where("subCategoryId", "==", sub.id));
            pSnap = await getDocs(pQuery);
        }
        
        let productsArray = [];
        pSnap.forEach(pDoc => { productsArray.push({ id: pDoc.id, ...pDoc.data() }); });

        const sliderKey = `slider_${sub.id}`;
        sliderStates[sliderKey] = { index: 0, total: productsArray.length };

        let pItemsHtml = "";
        if (productsArray.length > 0) {
            productsArray.forEach((p, idx) => {
                const isActive = idx < 3 ? "active-node" : "";

                // ĐÃ ĐIỀU CHỈNH: Kiểm tra luồng hiển thị Giá hoặc Điểm cho hệ thống slider
                const isPoints = checkIsPointsCategory(p, parentName, parentId);
                const displayPrice = isPoints 
                    ? `${(p.pointsRequired || 0).toLocaleString('vi-VN')} Điểm đổi`
                    : `${Number(p.price || 0).toLocaleString('vi-VN')} đ`;

                pItemsHtml += `
                    <div class="slider-product-unit-card ${isActive}" data-index="${idx}" onclick="window.location.href='product.html?id=${p.id}'">
                        <div class="p-card-thumb-zoom">
                            <img src="${p.image || ''}" class="p-card-image">
                        </div>
                        <div class="p-card-body-details">
                            <h4 class="p-card-title-hover-red">${p.name}</h4>
                            <p class="p-card-price-tag ${isPoints ? 'points-style' : ''}">${displayPrice}</p>
                        </div>
                    </div>
                `;
            });
        } else {
            pItemsHtml = `<p class="table-sub-empty">Chưa có sản phẩm trong mục này.</p>`;
        }

        const showControls = productsArray.length > 3 ? "" : "style='display:none;'";

        htmlResult += `
            <div class="detailed-sub-row-slider-container" id="${sliderKey}">
                <div class="slider-left-header-pane">
                    <h2 class="slider-sub-title-red" onclick="window.location.href='catalog.html?subcategory=${sub.id}'">${sub.name}</h2>
                    <div class="slider-action-arrows-row" ${showControls}>
                        <button type="button" class="arrow-ctrl-btn prev-btn" data-target="${sliderKey}">&lt;</button>
                        <button type="button" class="arrow-ctrl-btn next-btn" data-target="${sliderKey}">&gt;</button>
                    </div>
                </div>
                <div class="slider-right-viewport-pane">
                    <div class="slider-track-rail">
                        ${pItemsHtml}
                    </div>
                </div>
            </div>
        `;
    }
    return htmlResult;
}

function attachSliderButtonEvents() {
    document.querySelectorAll(".arrow-ctrl-btn").forEach(btn => {
        btn.onclick = (e) => {
            const targetKey = e.target.dataset.target;
            const direction = e.target.classList.contains("next-btn") ? 1 : -1;
            const state = sliderStates[targetKey];
            const container = document.getElementById(targetKey);
            if (!state || !container) return;

            const maxPossibleIndex = Math.max(0, state.total - 3);
            state.index += direction;
            if (state.index < 0) state.index = maxPossibleIndex;
            if (state.index > maxPossibleIndex) state.index = 0;

            const allCards = container.querySelectorAll(".slider-product-unit-card");
            allCards.forEach(card => {
                const cardIdx = parseInt(card.dataset.index);
                if (cardIdx >= state.index && cardIdx < state.index + 3) {
                    card.classList.add("active-node");
                } else {
                    card.classList.remove("active-node");
                }
            });
        };
    });
}

/* ================= C. GIAO DIỆN KHÔNG CÓ SUB-CATEGORIES ("TRÀ", "FREEZE", "SẢN PHẨM ĐỔI ĐIỂM") ================= */
async function renderNoSubCategoryDetailedPage(categoryId, categoryData) {
    const pQuery = query(collection(db, "products"), where("categoryId", "==", categoryId));
    const pSnap = await getDocs(pQuery);
    
    let productsArray = [];
    pSnap.forEach(pDoc => { productsArray.push({ id: pDoc.id, ...pDoc.data() }); });

    const sliderKey = `slider_main_${categoryId}`;
    sliderStates[sliderKey] = { index: 0, total: productsArray.length };

    let pItemsHtml = "";
    if (productsArray.length > 0) {
        productsArray.forEach((p, idx) => {
            const isActive = idx < 3 ? "active-node" : "";

            // ĐÃ ĐIỀU CHỈNH: Kiểm tra luồng hiển thị Giá hoặc Điểm cho cấu trúc No-Sub-Category đặc biệt
            const isPoints = checkIsPointsCategory(p, categoryData.name, categoryId);
            const displayPrice = isPoints 
                ? `${(p.pointsRequired || 0).toLocaleString('vi-VN')} Điểm đổi`
                : `${Number(p.price || 0).toLocaleString('vi-VN')} đ`;

            pItemsHtml += `
                <div class="slider-product-unit-card ${isActive}" data-index="${idx}" onclick="window.location.href='product.html?id=${p.id}'">
                    <div class="p-card-thumb-zoom">
                        <img src="${p.image || ''}" class="p-card-image">
                    </div>
                    <div class="p-card-body-details">
                        <h4 class="p-card-title-hover-red">${p.name}</h4>
                        <p class="p-card-price-tag ${isPoints ? 'points-style' : ''}">${displayPrice}</p>
                    </div>
                </div>
            `;
        });
    } else {
        pItemsHtml = `<p class="table-sub-empty">Sản phẩm đang được cập nhật.</p>`;
    }

    const showControls = productsArray.length > 3 ? "" : "style='display:none;'";

    appRoot.innerHTML = `
        <div class="detailed-layout layout-no-sub scroll-reveal">
            <div class="category-hero-banner miniature" style="background-image: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.4)), url('${categoryData.image || ''}')">
                <h1 class="hero-title">${categoryData.name}</h1>
            </div>
            
            <div class="detailed-sub-row-slider-container margin-top-expanded" id="${sliderKey}">
                <div class="slider-left-header-pane">
                    <h2 class="slider-sub-title-red">${categoryData.name} Nổi Bật</h2>
                    <div class="slider-action-arrows-row" ${showControls}>
                        <button type="button" class="arrow-ctrl-btn prev-btn" data-target="${sliderKey}">&lt;</button>
                        <button type="button" class="arrow-ctrl-btn next-btn" data-target="${sliderKey}">&gt;</button>
                    </div>
                </div>
                <div class="slider-right-viewport-pane">
                    <div class="slider-track-rail">
                        ${pItemsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    attachSliderButtonEvents();
}

/* ================= NẠP CÁC CATEGORY KHÁC Ở CHÂN TRANG ================= */
async function injectOtherCategoriesShowcase(currentExcludeId) {
    const targetNode = document.getElementById("other-cats-injection-point");
    if (!targetNode) return;
    try {
        const snapshot = await getDocs(collection(db, "categories"));
        let finalHtml = "";
        snapshot.forEach(docSnap => {
            if (docSnap.id !== currentExcludeId) {
                const cat = docSnap.data();
                finalHtml += `
                    <div class="showcase-card-node" onclick="window.location.href='catalog.html?category=${docSnap.id}'">
                        <div class="showcase-img-zoom-frame">
                            <img src="${cat.image || ''}" class="showcase-cover-image">
                        </div>
                        <h4 class="showcase-card-title-hover-red">${cat.name}</h4>
                    </div>
                `;
            }
        });
        targetNode.innerHTML = finalHtml || `<p class="table-sub-empty">Không có danh mục khác liên quan.</p>`;
    } catch (error) { 
        console.error("Lỗi nạp showcase:", error); 
    }
}