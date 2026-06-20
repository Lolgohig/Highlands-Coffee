import { db, auth } from "../../../services/firebase.config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DOM SELECTORS TOÀN CỤC ================= */
const megaMenu = document.getElementById("megaMenu");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");
const appRoot = document.getElementById("product-app-root");

/* TRẠNG THÁI TOÀN CỤC */
let currentSliderIndex = 0;
let currentProduct = null;   // Lưu thông tin sản phẩm đang xem
let selectedSize = "S";      // Kích cỡ mặc định

/* ================= INITIALIZATION BLOCK ================= */
document.addEventListener("DOMContentLoaded", () => {
    initAuthLogic();      // Xử lý Avatar & Đăng xuất đồng bộ
    loadMegaMenu();       // Tải cấu trúc danh mục Mega Menu
    initScrollReveal();   // Kích hoạt hiệu ứng cuộn mượt
    loadProductDetails(); // Xử lý bóc tách ID từ URL và render chi tiết sản phẩm + slide liên quan
});

/* ================= 1. AUTH & AVATAR LOGIC (ĐỒNG BỘ) ================= */
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
        if (!user) return;
        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists() && navbarAvatar) {
                navbarAvatar.src = snap.data().avatar || "https://i.pravatar.cc/150";
            }
        } catch (err) { 
            console.error("Lỗi tải avatar hệ thống:", err); 
        }
    });
}

/* ================= 2. LOAD MEGA MENU (ĐỒNG BỘ) ================= */
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

/* ================= 3. SCROLL REVEAL (ĐỒNG BỘ) ================= */
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

/* ================= 4. CORE PRODUCT DETAIL ENGINE ================= */
async function loadProductDetails() {
    if (!appRoot) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    if (!productId) {
        appRoot.innerHTML = `<div class="product-error">Không tìm thấy mã sản phẩm yêu cầu trong hệ thống.</div>`;
        return;
    }

    try {
        // Bước A: Tải chi tiết thông tin sản phẩm hiện tại
        const productDoc = await getDoc(doc(db, "products", productId));
        if (!productDoc.exists()) {
            appRoot.innerHTML = `<div class="product-error">Món ăn này không tồn tại hoặc đã bị gỡ bỏ.</div>`;
            return;
        }

        currentProduct = { id: productDoc.id, ...productDoc.data() };
        
        // Đổi tiêu đề trình duyệt theo tên sản phẩm
        document.title = `${currentProduct.name} | Highlands Coffee`;

        // Bước B: Lấy sản phẩm liên quan (Sử dụng đúng trường subCategoryId / categoryId trên Firestore)
        let relatedProducts = [];
        
        if (currentProduct.subCategoryId && currentProduct.subCategoryId.trim() !== "") {
            const qSub = query(
                collection(db, "products"), 
                where("subCategoryId", "==", currentProduct.subCategoryId)
            );
            const snapSub = await getDocs(qSub);
            snapSub.forEach(d => { 
                if (d.id !== productId) relatedProducts.push({ id: d.id, ...d.data() }); 
            });
        }

        if (relatedProducts.length === 0 && currentProduct.categoryId && currentProduct.categoryId.trim() !== "") {
            const qCat = query(
                collection(db, "products"), 
                where("categoryId", "==", currentProduct.categoryId)
            );
            const snapCat = await getDocs(qCat);
            snapCat.forEach(d => { 
                if (d.id !== productId) relatedProducts.push({ id: d.id, ...d.data() }); 
            });
        }

        // Bước C: Render giao diện chi tiết sản phẩm
        renderFullProductLayout(currentProduct, relatedProducts);

    } catch (error) {
        console.error("Lỗi tải chi tiết sản phẩm:", error);
        appRoot.innerHTML = `<div class="product-error">Hệ thống gặp sự cố khi đồng bộ dữ liệu.</div>`;
    }
}

/* ================= 5. RENDER LAYOUT & INTERACTIONS ================= */
function renderFullProductLayout(product, relatedList) {
    let relatedItemsHtml = "";

    // Xử lý danh sách sản phẩm liên quan làm thanh Slide
    if (relatedList.length > 0) {
        relatedList.forEach(item => {
            const isPointsItem = (item.categoryName || "").toLowerCase().includes("sản phẩm sử dụng điểm") || item.categoryId === "points-category";
            const relatedPriceText = isPointsItem ? `${item.pointsRequired || 0} Điểm` : `${Number(item.price || 0).toLocaleString('vi-VN')} đ`;

            relatedItemsHtml += `
                <div class="related-item-card scroll-reveal" onclick="window.location.href='product.html?id=${item.id}'">
                    <div class="related-card-img-frame">
                        <img src="${item.image || ''}" alt="${item.name}">
                    </div>
                    <div class="related-card-title">${item.name}</div>
                    <div class="related-card-price">${relatedPriceText}</div>
                </div>
            `;
        });
    } else {
        relatedItemsHtml = `<div class="product-loading">Không có sản phẩm tương tự cùng danh mục.</div>`;
    }

    const hideControls = relatedList.length <= 3 ? "style='display:none;'" : "";

    // Lấy tên danh mục chính chuyển về dạng viết thường để bắt điều kiện
    const catName = (product.categoryName || "").toLowerCase() || (product.categoryId || "").toLowerCase();
    
    const isPointsCategory = catName.includes("sản phẩm sử dụng điểm") || product.categoryId === "points-category";
    
    // ĐÃ SỬA ĐỔI: Chỉ cho phép các danh mục chính "cà phê", "freeze", và "trà" có size (Bỏ check subCategoryName)
    const hasSizes = catName.includes("cà phê") || catName.includes("coffee") || catName.includes("trà") || catName.includes("tea") || catName.includes("freeze");

    // Khởi tạo hiển thị Giá / Điểm thưởng
    let pricingAreaHtml = "";
    if (isPointsCategory) {
        pricingAreaHtml = `<div class="product-detail-price points-type" id="dynamicPrice">${(product.pointsRequired || 0).toLocaleString('vi-VN')} ĐIỂM ĐỔI</div>`;
    } else {
        pricingAreaHtml = `<div class="product-detail-price" id="dynamicPrice">${Number(product.price || 0).toLocaleString('vi-VN')} đ</div>`;
    }

    // Khối giao diện chọn Size (Tăng 6.000 VNĐ cho mỗi cấp size)
    let sizeSelectorHtml = "";
    if (hasSizes && !isPointsCategory) {
        sizeSelectorHtml = `
            <div class="size-selection-box">
                <span class="size-title">Chọn Kích Cỡ (Size):</span>
                <div class="size-options">
                    <button class="size-btn active" data-size="S">S</button>
                    <button class="size-btn" data-size="M">M (+6.000đ)</button>
                    <button class="size-btn" data-size="L">L (+12.000đ)</button>
                </div>
            </div>
        `;
    }

    // --- ĐÃ ĐIỀU CHỈNH CHUẨN HOÁ KIỂM TRA TỒN KHO THEO FIRESTORE ---
    // Kiểm tra nếu status ghi nhận là "out-of-stock" thì ép về false ngay lập tức
    const isStock = product.status !== "out-of-stock" && (product.status === "in-stock" || product.inStock === true || product.inStock === undefined);
    const stockStatusHtml = isStock ? `<span class="status-tag in-stock">● Còn hàng trên hệ thống</span>` : `<span class="status-tag out-of-stock">● Hết hàng tạm thời</span>`;
    
    // Giao diện cụm nút mua / tăng giảm số lượng
    let purchaseControlHtml = "";
    if (isStock) {
        purchaseControlHtml = `
            <div class="purchase-action-group">
                <div class="quantity-selector">
                    <button type="button" id="btnDecrease">-</button>
                    <input type="number" id="inputQuantity" value="1" min="1" readonly>
                    <button type="button" id="btnIncrease">+</button>
                </div>
                <button class="btn-add-to-cart" id="addToCartBtn">
                    ${isPointsCategory ? 'ĐỔI QUÀ NGAY' : 'THÊM VÀO GIỎ HÀNG'}
                </button>
            </div>
        `;
    } else {
        // Thay vì hiện cụm nút chọn số lượng, chỉ xuất hiện một thông báo duy nhất và vô hiệu hóa hoàn toàn tương tác
        purchaseControlHtml = `<button class="btn-add-to-cart disabled" disabled style="background-color: #a0a0a0; cursor: not-allowed; width: 100%;">HẾT HÀNG TẠM THỜI</button>`;
    }

    // Gắn HTML tổng thể vào appRoot
    appRoot.innerHTML = `
        <div class="product-detail-wrapper scroll-reveal">
            <div class="product-image-container">
                <img class="product-main-img" src="${product.image || ''}" alt="${product.name}">
            </div>
            <div class="product-info-container">
                <h1 class="product-detail-title">${product.name}</h1>
                <div class="stock-status-wrapper">${stockStatusHtml}</div>
                ${pricingAreaHtml}
                ${sizeSelectorHtml}
                <p class="product-detail-desc">
                    ${product.description || 'Món ăn đậm đà hương vị thơm ngon đặc trưng của hệ thống Highlands Coffee, được chế biến từ nguyên liệu sạch đảm bảo tiêu chuẩn cao nhất.'}
                </p>
                ${purchaseControlHtml}
            </div>
        </div>

        <div class="related-products-section">
            <div class="related-header-row">
                <h2 class="related-section-title">Sản phẩm liên quan</h2>
                <div class="related-slider-controls" ${hideControls}>
                    <button class="slider-arrow-btn" id="relatedPrevBtn">&#10094;</button>
                    <button class="slider-arrow-btn" id="relatedNextBtn">&#10095;</button>
                </div>
            </div>
            <div class="related-slider-viewport">
                <div class="related-slider-track" id="relatedSliderTrack">
                    ${relatedItemsHtml}
                </div>
            </div>
        </div>
    `;

    // Kích hoạt hiển thị cho hiệu ứng cuộn mượt
    const reveals = appRoot.querySelectorAll(".scroll-reveal");
    reveals.forEach(el => el.classList.add("active"));

    // Xử lý logic tăng giảm số lượng món ăn
    if (isStock) {
        setupQuantityControls();
    }

    // Logic đổi giá tiền động khi click chọn Size
    if (hasSizes && !isPointsCategory) {
        const sizeButtons = appRoot.querySelectorAll(".size-btn");
        sizeButtons.forEach(btn => {
            btn.onclick = (e) => {
                sizeButtons.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                selectedSize = e.target.getAttribute("data-size");
                
                let sizeSurcharge = 0;
                if (selectedSize === "M") sizeSurcharge = 6000;
                if (selectedSize === "L") sizeSurcharge = 12000;
                
                const finalPrice = Number(product.price || 0) + sizeSurcharge;
                document.getElementById("dynamicPrice").textContent = `${finalPrice.toLocaleString('vi-VN')} đ`;
            };
        });
    }

    // Sự kiện Thêm vào Giỏ hàng / Đổi quà (Đẩy vào LocalStorage)
    const addToCartBtn = document.getElementById("addToCartBtn");
    if (addToCartBtn && isStock) {
        addToCartBtn.onclick = () => {
            const qtyInput = document.getElementById("inputQuantity");
            const quantity = parseInt(qtyInput.value) || 1;

            let sizeSurcharge = 0;
            if (!isPointsCategory && hasSizes) {
                if (selectedSize === "M") sizeSurcharge = 6000;
                if (selectedSize === "L") sizeSurcharge = 12000;
            }

            // Tạo payload object chuẩn lưu vào Giỏ hàng
            const cartItem = {
                id: product.id,
                name: product.name,
                image: product.image || "",
                quantity: quantity,
                isPointsItem: isPointsCategory,
                size: hasSizes && !isPointsCategory ? selectedSize : "Mặc định",
                price: isPointsCategory ? 0 : Number(product.price || 0) + sizeSurcharge,
                pointsRequired: isPointsCategory ? Number(product.pointsRequired || 0) : 0
            };

            // Lưu trữ vào giỏ hàng LocalStorage để trang cart.html lấy ra xử lý thanh toán
            let currentCart = JSON.parse(localStorage.getItem("highlands_cart")) || [];
            
            // Tìm xem món có cùng ID và cùng Size đã nằm trong giỏ chưa
            const existIndex = currentCart.findIndex(item => item.id === cartItem.id && item.size === cartItem.size);
            if (existIndex > -1) {
                currentCart[existIndex].quantity += quantity;
            } else {
                currentCart.push(cartItem);
            }

            localStorage.setItem("highlands_cart", JSON.stringify(currentCart));
            alert(`Đã thêm thành công ${quantity} sản phẩm vào giỏ hàng của bạn!`);
        };
    }

    // Kích hoạt chức năng lướt Slide sản phẩm liên quan
    if (relatedList.length > 3) {
        attachSliderEngine(relatedList.length);
    }
}

/* ================= 6. HÀM TĂNG GIẢM SỐ LƯỢNG MÓN ĂN ================= */
function setupQuantityControls() {
    const btnDecrease = document.getElementById("btnDecrease");
    const btnIncrease = document.getElementById("btnIncrease");
    const inputQuantity = document.getElementById("inputQuantity");

    if (!inputQuantity) return;

    btnDecrease.onclick = () => {
        let val = parseInt(inputQuantity.value) || 1;
        if (val > 1) inputQuantity.value = val - 1;
    };

    btnIncrease.onclick = () => {
        let val = parseInt(inputQuantity.value) || 1;
        inputQuantity.value = val + 1;
    };
}

/* ================= 7. SLIDER MOVEMENT ENGINE ================= */
function attachSliderEngine(totalItems) {
    const track = document.getElementById("relatedSliderTrack");
    const prevBtn = document.getElementById("relatedPrevBtn");
    const nextBtn = document.getElementById("relatedNextBtn");
    
    const itemsPerView = 3;
    const maxIndex = totalItems - itemsPerView;

    const updatePosition = () => {
        const itemNode = track.querySelector(".related-item-card");
        if (!itemNode) return;
        const itemWidth = itemNode.getBoundingClientRect().width;
        const offset = currentSliderIndex * (itemWidth + 30); // 30px tương đương gap trong CSS
        track.style.transform = `translateX(-${offset}px)`;
    };

    nextBtn.onclick = () => {
        if (currentSliderIndex < maxIndex) {
            currentSliderIndex++;
        } else {
            currentSliderIndex = 0;
        }
        updatePosition();
    };

    prevBtn.onclick = () => {
        if (currentSliderIndex > 0) {
            currentSliderIndex--;
        } else {
            currentSliderIndex = maxIndex;
        }
        updatePosition();
    };

    window.addEventListener("resize", updatePosition);
}