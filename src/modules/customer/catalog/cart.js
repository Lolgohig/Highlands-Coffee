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
  getDoc,
  addDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* =======================================================
   DOM ELEMENTS
======================================================= */
const megaMenu = document.getElementById("megaMenu");
const navbarAvatar = document.getElementById("navbarAvatar");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

const checkoutWorkspaceBlock = document.getElementById("checkout-workspace-block");
const orderHistoryWorkspaceBlock = document.getElementById("order-history-workspace-block");

const txtFullName = document.getElementById("txt-fullname");
const txtPhone = document.getElementById("txt-phone");
const txtAddress = document.getElementById("txt-address");

// Khối HTML dự phòng phục vụ trường hợp không định vị được địa chỉ ghi tay tự do
const fallbackGeoWrapper = document.getElementById("fallback-geo-wrapper") || createFallbackGeoDOM();
const selectProvince = document.getElementById("fallback-province");
const selectDistrict = document.getElementById("fallback-district");
const selectWard = document.getElementById("fallback-ward");

const radioTimeOptions = document.querySelectorAll('input[name="delivery-time-type"]');
const customDatetimePickerWrapper = document.getElementById("custom-datetime-picker-wrapper");
const dateDelivery = document.getElementById("date-delivery");
const timeDelivery = document.getElementById("time-delivery");

const couponInput = document.getElementById("coupon-input");
const btnApplyCoupon = document.getElementById("btn-apply-coupon");
const couponFeedbackMsg = document.getElementById("coupon-feedback-msg");

// Vùng chứa hiển thị quà tặng tặng kèm cấu hình cho chiến dịch Mua X Tặng Y
const giftSelectionZone = document.getElementById("gift-selection-zone") || createGiftZoneDOM();

const cartItemsContainer = document.getElementById("cart-items-injection-point");
const ledgerSubtotalCash = document.getElementById("ledger-subtotal-cash");
const ledgerShippingFee = document.getElementById("ledger-shipping-fee");
const shippingDistanceText = document.getElementById("shipping-distance-text");
const ledgerDiscount = document.getElementById("ledger-discount");
const ledgerTotalCash = document.getElementById("ledger-total-cash");
const ledgerTotalPoints = document.getElementById("ledger-total-points");
const userPointsBalanceLabel = document.getElementById("user-points-balance");
const btnSubmitOrder = document.getElementById("btn-submit-order");
const orderHistoryTbody = document.getElementById("order-history-tbody-injection");

/* =======================================================
   CẤU HÌNH ĐỊA CHỈ SHOP CỐ ĐỊNH (TRUNG TÂM ĐÔNG HÒA, DĨ AN, BÌNH DƯƠNG)
======================================================= */
const SHOP_LAT = 10.899216; 
const SHOP_LNG = 106.784534;

let localCartItems = [];
let currentUserAccount = null;
let currentUserPointsBalance = 0;

// Các biến trạng thái Core xử lý Campaign phức tạp
let activeCampaignData = null;
let selectedGiftPayload = null; 

let sumTotalCashBeforeDiscount = 0;
let sumTotalPointsRequired = 0;
let finalCashToPay = 0;
let activeDiscountValue = 0;
let calculatedShippingFee = 0;
let computedDistanceKm = 0;

/* =======================================================
   TỰ ĐỘNG KHỞI TẠO DOM GIAO DIỆN PHỤ TRỢ (NẾU CHƯA CÓ TRONG HTML)
======================================================= */
function createFallbackGeoDOM() {
  const container = document.createElement("div");
  container.id = "fallback-geo-wrapper";
  container.style.cssText = "display:none; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:12px;";
  container.innerHTML = `
    <select id="fallback-province" class="form-control"><option value="">-- Chọn Tỉnh/TP --</option></select>
    <select id="fallback-district" class="form-control"><option value="">-- Chọn Quận/Huyện --</option></select>
    <select id="fallback-ward" class="form-control"><option value="">-- Chọn Phường/Xã --</option></select>
  `;
  if (txtAddress && txtAddress.parentNode) txtAddress.parentNode.appendChild(container);
  return container;
}

function createGiftZoneDOM() {
  const zone = document.createElement("div");
  zone.id = "gift-selection-zone";
  zone.style.cssText = "margin: 15px 0; padding: 15px; border: 2px dashed #7b001f; background: #fffcfc; border-radius:12px; display:none;";
  if (couponFeedbackMsg && couponFeedbackMsg.parentNode) {
    couponFeedbackMsg.parentNode.insertBefore(zone, couponFeedbackMsg.nextSibling);
  }
  return zone;
}

/* =======================================================
   NAVBAR PROFILE DROPDOWN
======================================================= */
if (navbarAvatar && dropdownMenu) {
  navbarAvatar.onclick = (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
  };
  window.onclick = (e) => {
    if (!e.target.closest(".profile-dropdown")) {
      dropdownMenu.classList.remove("show");
    }
  };
}

/* =======================================================
   ĐỒNG BỘ ACCOUNT & LOAD AVATAR
======================================================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }
  currentUserAccount = user;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;
    const data = snap.data();
    
    if (navbarAvatar) navbarAvatar.src = data.avatar || "https://i.pravatar.cc/150";
    if (txtFullName) txtFullName.value = data.fullName || data.name || "Khách Hàng Highlands";
    if (txtPhone) txtPhone.value = data.phone || "Chưa cập nhật SĐT";
    
    await initFallbackGeoData();

    if (txtAddress && data.address) {
      txtAddress.value = data.address;
      updateShippingWorkflow();
    }

    currentUserPointsBalance = data.points || 0;
    if (userPointsBalanceLabel) {
      userPointsBalanceLabel.textContent = currentUserPointsBalance.toLocaleString('vi-VN');
    }
    setupCartModule();
    fetchUserOrdersHistory();
  } catch (err) {
    console.error(err);
  }
});

/* =======================================================
   LOGOUT ĐĂNG XUẤT
======================================================= */
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      window.location.href = "auth.html";
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };
}

/* =======================================================
   LOAD MEGA MENU CHUẨN
======================================================= */
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
      column.innerHTML = `<h4><a href="catalog.html?category=${category.id}">${category.name}</a></h4>`;

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
    console.error("Lỗi đồng bộ cấu trúc Mega Menu:", err);
  }
}

/* =======================================================
   QUẢN LÝ RENDER GIỎ HÀNG & HÓA ĐƠN
======================================================= */
function setupCartModule() {
  loadMegaMenu();
  setupDeliveryTimeToggle();
  
  localCartItems = JSON.parse(localStorage.getItem("highlands_cart")) || [];
  renderCartSummaryUI();

  if (txtAddress) {
    txtAddress.addEventListener("change", updateShippingWorkflow);
  }
  attachCouponEngine();
  attachOrderSubmission();
}

function renderCartSummaryUI() {
  if (!cartItemsContainer) return;

  if (localCartItems.length === 0) {
    cartItemsContainer.innerHTML = `<div class="empty-cart-alert"><i class="fa-solid fa-folder-open"></i> Giỏ hàng trống.</div>`;
    disableCheckoutForm();
    if (giftSelectionZone) giftSelectionZone.style.display = "none";
    return;
  }

  let itemsHtml = "";
  sumTotalCashBeforeDiscount = 0;
  sumTotalPointsRequired = 0;

  localCartItems.forEach((item, index) => {
    const isPointProduct = item.pointsRequired > 0 || item.category === "sản phẩm sử dụng điểm";
    const singlePrice = isPointProduct ? 0 : (Number(item.price) || 0);
    const singlePoints = isPointProduct ? (Number(item.pointsRequired) || 0) : 0;

    sumTotalCashBeforeDiscount += singlePrice * (item.quantity || 1);
    sumTotalPointsRequired += singlePoints * (item.quantity || 1);

    const textDisplayPrice = isPointProduct 
      ? `<span class="point-badge-cost">${singlePoints.toLocaleString('vi-VN')} Điểm / món</span>`
      : `<span>${singlePrice.toLocaleString('vi-VN')} đ</span>`;

    itemsHtml += `
      <div class="summary-product-item-row">
        <img src="${item.image || 'https://www.highlandscoffee.com.vn/vnt_upload/product/04_2023/PRODUCT/(H)_PHIN_SUA_DA.png'}" alt="${item.name}" />
        <div class="item-middle-details">
          <div class="item-title-name">${item.name}</div>
          <div class="item-meta-info">Size: <strong>${item.size || 'M'}</strong> | SL: <strong>${item.quantity}</strong></div>
          <div class="item-price-view">${textDisplayPrice}</div>
        </div>
        <button type="button" class="btn-delete-cart-item" data-index="${index}">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = itemsHtml;

  document.querySelectorAll(".btn-delete-cart-item").forEach(button => {
    button.onclick = () => {
      const targetIndex = parseInt(button.dataset.index);
      localCartItems.splice(targetIndex, 1);
      localStorage.setItem("highlands_cart", JSON.stringify(localCartItems));
      
      activeCampaignData = null;
      selectedGiftPayload = null;
      if (giftSelectionZone) giftSelectionZone.style.display = "none";
      if (couponInput) couponInput.value = "";
      if (couponFeedbackMsg) couponFeedbackMsg.textContent = "";

      renderCartSummaryUI();
      updateShippingWorkflow();
    };
  });

  calculateFinalLedgerBalances();
}

function calculateFinalLedgerBalances() {
  if (computedDistanceKm > 50) {
    disableCheckoutFormDueToDistance();
    return;
  }

  activeDiscountValue = 0;
  let giftSurcharge = 0; 

  if (activeCampaignData) {
    if (activeCampaignData.type === "percentage") {
      const pct = Number(activeCampaignData.discountPercent) || 0;
      activeDiscountValue = Math.floor(sumTotalCashBeforeDiscount * (pct / 100));
    } 
    else if (activeCampaignData.type === "flat_amount") {
      const flatVal = Number(activeCampaignData.discountFlatValue) || 0;
      activeDiscountValue = Math.min(sumTotalCashBeforeDiscount, flatVal);
    }
    else if (activeCampaignData.type === "buy_x_get_y") {
      activeDiscountValue = 0; 
      if (selectedGiftPayload) {
        giftSurcharge = selectedGiftPayload.customerPay || 0;
      }
    }
  }

  finalCashToPay = Math.max(0, sumTotalCashBeforeDiscount - activeDiscountValue) + calculatedShippingFee + giftSurcharge;

  if (ledgerSubtotalCash) ledgerSubtotalCash.textContent = `${sumTotalCashBeforeDiscount.toLocaleString('vi-VN')} đ`;
  if (ledgerShippingFee) ledgerShippingFee.textContent = `${calculatedShippingFee.toLocaleString('vi-VN')} đ`;
  if (ledgerDiscount) ledgerDiscount.textContent = `-${activeDiscountValue.toLocaleString('vi-VN')} đ`;
  
  if (ledgerTotalCash) {
    if (giftSurcharge > 0) {
      ledgerTotalCash.innerHTML = `${finalCashToPay.toLocaleString('vi-VN')} đ <small style="font-size:11px; color:#7b001f; font-weight:bold;">(Đã gồm +${giftSurcharge.toLocaleString('vi-VN')}đ nâng size quà)</small>`;
    } else {
      ledgerTotalCash.textContent = `${finalCashToPay.toLocaleString('vi-VN')} đ`;
    }
  }
  if (ledgerTotalPoints) ledgerTotalPoints.textContent = `${sumTotalPointsRequired.toLocaleString('vi-VN')} Điểm`;

  if (btnSubmitOrder && localCartItems.length > 0) {
    btnSubmitOrder.removeAttribute("disabled");
    btnSubmitOrder.classList.remove("disabled");
  }
}

function disableCheckoutForm() {
  if (ledgerSubtotalCash) ledgerSubtotalCash.textContent = "0 đ";
  if (ledgerShippingFee) ledgerShippingFee.textContent = "0 đ";
  if (ledgerDiscount) ledgerDiscount.textContent = "-0 đ";
  if (ledgerTotalCash) ledgerTotalCash.textContent = "0 đ";
  if (ledgerTotalPoints) ledgerTotalPoints.textContent = "0 Điểm";
  if (btnSubmitOrder) {
    btnSubmitOrder.setAttribute("disabled", "true");
    btnSubmitOrder.classList.add("disabled");
  }
}

/* =======================================================
   MÃ GIẢM GIÁ CAMPAIGN & ENGINE KIỂM TRA LOẠI THÔNG MINH
======================================================= */
function attachCouponEngine() {
  if (!btnApplyCoupon) return;
  btnApplyCoupon.onclick = async () => {
    const enteredCode = couponInput.value.trim().toUpperCase();
    if (!enteredCode) return;

    try {
      const queryCampaign = query(collection(db, "campaigns"), where("code", "==", enteredCode));
      const resultSnap = await getDocs(queryCampaign);
      
      if (resultSnap.empty) {
        activeCampaignData = null;
        selectedGiftPayload = null;
        if (giftSelectionZone) giftSelectionZone.style.display = "none";
        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = "❌ Mã khuyến mãi không chính xác hoặc đã hết hạn sử dụng!";
          couponFeedbackMsg.className = "coupon-status-msg error";
        }
        calculateFinalLedgerBalances();
        return;
      }

      const campaignDocData = resultSnap.docs[0].data();
      
      if (campaignDocData.type === "percentage") {
        activeCampaignData = campaignDocData;
        selectedGiftPayload = null;
        if (giftSelectionZone) giftSelectionZone.style.display = "none";
        
        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = `🟢 Áp dụng thành công: Chiến dịch giảm giá ${campaignDocData.discountPercent}% cho toàn bộ hóa đơn thỏa điều kiện.`;
          couponFeedbackMsg.className = "coupon-status-msg success";
        }
        calculateFinalLedgerBalances();
      } 
      else if (campaignDocData.type === "flat_amount") {
        activeCampaignData = campaignDocData;
        selectedGiftPayload = null;
        if (giftSelectionZone) giftSelectionZone.style.display = "none";

        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = `🟢 Áp dụng thành công: Chiến dịch ưu đãi trừ thẳng trực tiếp ${(campaignDocData.discountFlatValue || 0).toLocaleString('vi-VN')}đ vào hóa đơn.`;
          couponFeedbackMsg.className = "coupon-status-msg success";
        }
        calculateFinalLedgerBalances();
      }
      else if (campaignDocData.type === "buy_x_get_y" || (!campaignDocData.type && campaignDocData.buyQty)) {
        campaignDocData.type = "buy_x_get_y";
        
        const enrichedItems = await enrichCartItemsWithCategories(localCartItems);
        let totalXEligibleQty = 0;

        enrichedItems.forEach(item => {
          const isCatMatch = campaignDocData.buyCategories && campaignDocData.buyCategories.includes(item.parentCategoryId);
          const isSubMatch = campaignDocData.buySubCategories && campaignDocData.buySubCategories.includes(item.subCategoryId);
          
          if (isCatMatch || isSubMatch || !campaignDocData.buyCategories || campaignDocData.buyCategories.length === 0) {
            totalXEligibleQty += (item.quantity || 1);
          }
        });

        const requiredX = campaignDocData.buyQty || 1;
        if (totalXEligibleQty < requiredX) {
          activeCampaignData = null;
          selectedGiftPayload = null;
          if (giftSelectionZone) giftSelectionZone.style.display = "none";
          if (couponFeedbackMsg) {
            couponFeedbackMsg.textContent = `⚠️ Giỏ hàng chưa đạt điều kiện! Chiến dịch yêu cầu mua tối thiểu ${requiredX} món thuộc danh mục quy định (Hiện tại mới có: ${totalXEligibleQty} món).`;
            couponFeedbackMsg.className = "coupon-status-msg error";
          }
          calculateFinalLedgerBalances();
          return;
        }

        activeCampaignData = campaignDocData;
        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = `🟢 Đạt điều kiện: Chiến dịch ưu đãi độc quyền [Mua ${campaignDocData.buyQty} Tặng ${campaignDocData.getQty}]. Vui lòng chọn món quà tặng phía dưới!`;
          couponFeedbackMsg.className = "coupon-status-msg success";
        }
        
        await renderGiftSelectionInterface(campaignDocData);
      }

    } catch (error) {
      console.error("Lỗi xử lý Engine mã ưu đãi:", error);
    }
  };
}

/* KHẮC PHỤC LỖI LỌC QUÀ TẶNG: Kiểm tra chặt chẽ điều kiện Sub-Category để tránh lấy lan ra cả Category */
async function renderGiftSelectionInterface(campaignData) {
  if (!giftSelectionZone) return;
  giftSelectionZone.innerHTML = "🔄 Đang đồng bộ danh sách sản phẩm quà tặng phù hợp...";
  giftSelectionZone.style.display = "block";

  try {
    const prodSnapshot = await getDocs(collection(db, "products"));
    let eligibleGifts = [];

    const hasCatFilter = campaignData.getCategories && Array.isArray(campaignData.getCategories) && campaignData.getCategories.length > 0;
    const hasSubFilter = campaignData.getSubCategories && Array.isArray(campaignData.getSubCategories) && campaignData.getSubCategories.length > 0;

    prodSnapshot.forEach(pDoc => {
      const pData = pDoc.data();
      if (pData.status !== "in-stock") return;

      const prodCategoryId = pData.categoryId || pData.category || "";
      const prodSubCategoryId = pData.subCategoryId || pData.subCategory || "";

      let isMatch = false;

      if (hasCatFilter && hasSubFilter) {
        if (campaignData.getCategories.includes(prodCategoryId) && campaignData.getSubCategories.includes(prodSubCategoryId)) {
          isMatch = true;
        }
      } else if (hasSubFilter) {
        if (campaignData.getSubCategories.includes(prodSubCategoryId)) {
          isMatch = true;
        }
      } else if (hasCatFilter) {
        if (campaignData.getCategories.includes(prodCategoryId)) {
          isMatch = true;
        }
      } else {
        isMatch = true;
      }

      if (isMatch) {
        eligibleGifts.push({ id: pDoc.id, ...pData });
      }
    });

    if (eligibleGifts.length === 0) {
      giftSelectionZone.innerHTML = `<p style="color:#e53935;">⚠️ Không tìm thấy sản phẩm quà tặng phù hợp với cấu hình của chiến dịch.</p>`;
      return;
    }

    let zoneHtml = `
      <h4 style="color:#7b001f; margin-bottom:10px;"><i class="fa-solid fa-gift"></i> DANH SÁCH QUÀ TẶNG BẠN ĐƯỢC NHẬN:</h4>
      <div class="input-group">
        <label style="font-size:14px; font-weight:600;">1. Chọn món quà:</label>
        <select id="gift-product-select" class="form-control" style="margin-bottom:10px;">
          ${eligibleGifts.map(g => `
            <option value="${g.id}" 
                    data-name="${g.name}" 
                    data-img="${g.image || ''}" 
                    data-price="${g.price || 0}"
                    data-categoryid="${g.categoryId || g.category || ''}"
                    data-subcategoryname="${g.subCategoryName || ''}">
              ${g.name} (Tặng kèm miễn phí)
            </option>
          `).join("")}
        </select>
      </div>
      <div class="input-group" id="gift-size-selection-wrapper">
        <label style="font-size:14px; font-weight:600;">2. Chọn Kích thước (Size):</label>
        <div style="display:flex; gap:15px; margin-top:5px;">
          <label><input type="radio" name="gift-size-option" value="S" checked> Size S (Miễn phí hoàn toàn)</label>
          <label><input type="radio" name="gift-size-option" value="M"> Size M (+6.000 đ phụ thu)</label>
          <label><input type="radio" name="gift-size-option" value="L"> Size L (+6.000 đ phụ thu)</label>
        </div>
      </div>
    `;

    giftSelectionZone.innerHTML = zoneHtml;

    const giftProductSelect = document.getElementById("gift-product-select");
    const giftSizeWrapper = document.getElementById("gift-size-selection-wrapper");
    const giftSizeRadios = document.querySelectorAll('input[name="gift-size-option"]');

    const recalculateGiftNodeLogic = () => {
      const selectedOpt = giftProductSelect.options[giftProductSelect.selectedIndex];
      const subCategoryName = selectedOpt.dataset.subcategoryname || "";
      const categoryId = selectedOpt.dataset.categoryid || "";

      const isCakeProduct = subCategoryName.includes("Bánh") || subCategoryName.includes("bánh") || categoryId === "L40Vp8L02zWzj0AhwYGd";

      let chosenSize = "S";
      
      if (isCakeProduct) {
        if (giftSizeWrapper) giftSizeWrapper.style.display = "none";
        chosenSize = "S";
      } else {
        if (giftSizeWrapper) giftSizeWrapper.style.display = "block";
        const checkedRadio = document.querySelector('input[name="gift-size-option"]:checked');
        chosenSize = checkedRadio ? checkedRadio.value : "S";
      }
      
      let finalGiftPriceCustomerMustPay = 0; 

      if (!isCakeProduct && (chosenSize === "M" || chosenSize === "L")) {
        finalGiftPriceCustomerMustPay = 6000;
      }

      selectedGiftPayload = {
        id: giftProductSelect.value,
        name: selectedOpt.dataset.name,
        image: selectedOpt.dataset.img,
        size: chosenSize,
        quantity: campaignData.getQty || 1,
        isGiftItem: true,
        customerPay: finalGiftPriceCustomerMustPay,
        discountContribution: 0
      };

      calculateFinalLedgerBalances();
    };

    giftProductSelect.onchange = recalculateGiftNodeLogic;
    giftSizeRadios.forEach(r => r.onchange = recalculateGiftNodeLogic);

    recalculateGiftNodeLogic();

  } catch (err) {
    console.error("Lỗi tải danh mục sản phẩm quà tặng:", err);
    giftSelectionZone.innerHTML = `<p style="color:#e53935;">⚠️ Có lỗi xảy ra khi đồng bộ danh sách quà tặng.</p>`;
  }
}

async function enrichCartItemsWithCategories(cartItems) {
  if (!cartItems || cartItems.length === 0) return [];

  const enriched = await Promise.all(cartItems.map(async (item) => {
    try {
      const productSnap = await getDoc(doc(db, "products", item.id));
      if (productSnap.exists()) {
        const prodData = productSnap.data();
        return {
          ...item,
          parentCategoryId: prodData.category || prodData.categoryId || "",
          subCategoryId: prodData.subCategory || prodData.subCategoryId || "",
          subCategoryName: prodData.subCategoryName || prodData.categoryName || "Chưa phân loại"
        };
      }
    } catch (err) {
      console.error(`Lỗi tìm danh mục cho món ${item.name}:`, err);
    }
    return { ...item, subCategoryName: "Chưa phân loại", parentCategoryId: "", subCategoryId: "" };
  }));

  return enriched;
}

/* =======================================================
   CẤU HÌNH THỜI GIAN NHẬN HÀNG (MIN CHÊNH 60 PHÚT)
======================================================= */
function setupDeliveryTimeToggle() {
  radioTimeOptions.forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        if (customDatetimePickerWrapper) customDatetimePickerWrapper.style.display = "grid";
        setDefaultAndMinDatetime();
      } else {
        if (customDatetimePickerWrapper) customDatetimePickerWrapper.style.display = "none";
        if (dateDelivery) dateDelivery.value = "";
        if (timeDelivery) timeDelivery.value = "";
      }
    });
  });
}

function setDefaultAndMinDatetime() {
  const now = new Date();
  const minTimeBound = new Date(now.getTime() + 60 * 60 * 1000);

  const yyyy = minTimeBound.getFullYear();
  const mm = String(minTimeBound.getMonth() + 1).padStart(2, '0');
  const dd = String(minTimeBound.getDate()).padStart(2, '0');
  
  const hours = String(minTimeBound.getHours()).padStart(2, '0');
  const minutes = String(minTimeBound.getMinutes()).padStart(2, '0');

  if (dateDelivery) {
    dateDelivery.min = `${yyyy}-${mm}-${dd}`;
    dateDelivery.value = `${yyyy}-${mm}-${dd}`;
  }
  if (timeDelivery) timeDelivery.value = `${hours}:${minutes}`;
}

/* =======================================================
   ALGORITHM TÍNH KHOẢNG CÁCH SHIP HÀNG & 2-TIER GEOPROCESSING
======================================================= */
function computeHaversineInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

async function fetchCoordinatesViaOSM(addressString) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}&limit=1`, {
      headers: {
        "User-Agent": "HighlandsCoffeeDeliveryApp/2.0 (contact: support@highlandscoffee.com)"
      }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error("Lỗi Geocoding OpenStreetMap:", error);
    return null;
  }
}

function cleanAdministrativeString(str) {
  return str
    .replace(/Tỉnh|Thành phố|Quận|Huyện|Phường|Xã|Thị xã/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* KHẮC PHỤC LỖI TÍNH SHIP: Ghép chuỗi chuẩn hóa từ ô selectbox khi ô viết tay lỗi */
async function updateShippingWorkflow() {
  const originalAddress = txtAddress ? txtAddress.value.trim() : "";
  let coords = null;

  if (couponFeedbackMsg) {
    couponFeedbackMsg.textContent = "🔄 Đang phân tích tọa độ địa chỉ và tính toán chi phí vận chuyển...";
    couponFeedbackMsg.className = "coupon-status-msg success";
  }

  if (originalAddress.length >= 8) {
    const addressParts = originalAddress.split(",").map(part => part.trim());
    let cleanAddressForAPI = originalAddress;

    if (addressParts.length >= 3) {
      const lastThreeParts = addressParts.slice(-3); 
      cleanAddressForAPI = lastThreeParts.join(", ");
      if (cleanAddressForAPI.toLowerCase().includes("hồ chí minh") || cleanAddressForAPI.toLowerCase().includes("thành phố hồ chí minh")) {
        cleanAddressForAPI = cleanAddressForAPI.replace(/hồ chí minh/i, "Bình Dương").replace(/thành phố hồ chí minh/i, "Bình Dương");
      }
    }
    coords = await fetchCoordinatesViaOSM(cleanAddressForAPI);
  }

  if (!coords) {
    if (fallbackGeoWrapper) fallbackGeoWrapper.style.display = "grid";

    const provText = selectProvince?.options[selectProvince.selectedIndex]?.text || "";
    const distText = selectDistrict?.options[selectDistrict.selectedIndex]?.text || "";
    const wardText = selectWard?.options[selectWard.selectedIndex]?.text || "";

    if (provText && distText && wardText && !provText.includes("--") && !distText.includes("--") && !wardText.includes("--")) {
      const cleanWard = cleanAdministrativeString(wardText);
      const cleanDist = cleanAdministrativeString(distText);
      const cleanProv = cleanAdministrativeString(provText);

      const builtFallbackString = `${cleanWard}, ${cleanDist}, ${cleanProv}`;
      coords = await fetchCoordinatesViaOSM(builtFallbackString);
    }
  } else {
    if (fallbackGeoWrapper) fallbackGeoWrapper.style.display = "none";
  }

  if (coords) {
    computedDistanceKm = computeHaversineInKm(SHOP_LAT, SHOP_LNG, coords.lat, coords.lng) * 1.3;
    
    if (computedDistanceKm > 50) {
      calculatedShippingFee = 0;
      if (shippingDistanceText) shippingDistanceText.textContent = `${computedDistanceKm.toFixed(1)} km (Quá xa)`;
      if (couponFeedbackMsg) {
        couponFeedbackMsg.textContent = `❌ Từ chối giao hàng: Khoảng cách (${computedDistanceKm.toFixed(1)} km) vượt quá giới hạn 50km của shop!`;
        couponFeedbackMsg.className = "coupon-status-msg error";
      }
      disableCheckoutFormDueToDistance();
      return;
    }

    if (computedDistanceKm <= 3) {
      calculatedShippingFee = 15000;
    } else {
      calculatedShippingFee = 15000 + Math.floor((computedDistanceKm - 3) * 5000);
    }

    if (shippingDistanceText) shippingDistanceText.textContent = `${computedDistanceKm.toFixed(1)} km`;
    if (couponFeedbackMsg && !couponFeedbackMsg.textContent.includes("thành công") && !couponFeedbackMsg.textContent.includes("Áp dụng")) {
      couponFeedbackMsg.textContent = `📍 Định vị thành công! Khoảng cách giao hàng: ${computedDistanceKm.toFixed(1)} km.`;
      couponFeedbackMsg.className = "coupon-status-msg success";
    }
  } else {
    computedDistanceKm = 0;
    calculatedShippingFee = 25000; 
    if (shippingDistanceText) shippingDistanceText.textContent = "Đang xác định...";
  }

  calculateFinalLedgerBalances();
}

function disableCheckoutFormDueToDistance() {
  if (ledgerShippingFee) ledgerShippingFee.textContent = "Không hỗ trợ";
  if (ledgerTotalCash) ledgerTotalCash.textContent = "---";
  if (btnSubmitOrder) {
    btnSubmitOrder.setAttribute("disabled", "true");
    btnSubmitOrder.classList.add("disabled");
  }
}

/* Khởi tạo dữ liệu từ API cho bộ 3 Ô Chọn địa phương */
async function initFallbackGeoData() {
  if (!selectProvince) return;
  try {
    const res = await fetch("https://provinces.open-api.vn/api/?depth=3");
    const data = await res.json();

    selectProvince.innerHTML = `<option value="">-- Chọn Tỉnh/TP --</option>` + 
      data.map(p => `<option value="${p.code}">${p.name}</option>`).join("");

    selectProvince.onchange = () => {
      const pCode = selectProvince.value;
      const foundP = data.find(p => p.code == pCode);
      if (foundP && selectDistrict) {
        selectDistrict.innerHTML = `<option value="">-- Chọn Quận/Huyện --</option>` + 
          foundP.districts.map(d => `<option value="${d.code}">${d.name}</option>`).join("");
        if (selectWard) selectWard.innerHTML = `<option value="">-- Chọn Phường/Xã --</option>`;
      }
      updateShippingWorkflow();
    };

    selectDistrict.onchange = () => {
      const pCode = selectProvince.value;
      const dCode = selectDistrict.value;
      const foundP = data.find(p => p.code == pCode);
      const foundD = foundP?.districts.find(d => d.code == dCode);
      if (foundD && selectWard) {
        selectWard.innerHTML = `<option value="">-- Chọn Phường/Xã --</option>` + 
          foundD.wards.map(w => `<option value="${w.code}">${w.name}</option>`).join("");
      }
      updateShippingWorkflow();
    };

    selectWard.onchange = () => {
      updateShippingWorkflow();
    };

  } catch (err) {
    console.error("Không thể tải API địa giới hành chính:", err);
  }
}

/* =======================================================
   SUBMIT ĐẶT HÀNG & RÀNG BUỘC THỜI GIAN CHÊNH 60 PHÚT
======================================================= */
function attachOrderSubmission() {
  if (!btnSubmitOrder) return;

  btnSubmitOrder.onclick = async () => {
    if (!currentUserAccount) return;

    const shipAddress = txtAddress.value.trim();
    if (!shipAddress) {
      alert("Vui lòng điền thông tin địa chỉ chi tiết cụ thể để giao hàng!");
      return;
    }

    if (computedDistanceKm > 50) {
      alert("Đặt hàng thất bại! Khoảng cách giao hàng vượt quá giới hạn 50km.");
      return;
    }

    const selectedTimeType = document.querySelector('input[name="delivery-time-type"]:checked').value;
    let finalScheduleString = "Càng sớm càng tốt";

    if (selectedTimeType === "custom") {
      const dateVal = dateDelivery.value;
      const timeVal = timeDelivery.value;

      if (!dateVal || !timeVal) {
        alert("Vui lòng chọn đầy đủ Ngày và Giờ nhận hàng tùy ý!");
        return;
      }

      const userSelectedDateTime = new Date(`${dateVal}T${timeVal}`);
      const currentSystemTime = new Date();
      
      const timeDifferenceInMs = userSelectedDateTime.getTime() - currentSystemTime.getTime();
      const oneHourInMs = 60 * 60 * 1000;

      if (timeDifferenceInMs < oneHourInMs) {
        alert("Thời gian đặt lịch hẹn nhận hàng tùy ý phải cách thời gian hiện tại ít nhất 60 phút!");
        return;
      }

      finalScheduleString = `${dateVal} lúc ${timeVal}`;
    }

    if (sumTotalPointsRequired > currentUserPointsBalance) {
      alert("Tài khoản thành viên không đủ số lượng điểm để thực hiện đổi món ăn này!");
      return;
    }

    try {
      btnSubmitOrder.setAttribute("disabled", "true");
      btnSubmitOrder.textContent = "Đang tiến hành lập đơn hàng...";

      if (sumTotalPointsRequired > 0) {
        const finalCalculatedPointsBalance = currentUserPointsBalance - sumTotalPointsRequired;
        await updateDoc(doc(db, "users", currentUserAccount.uid), { points: finalCalculatedPointsBalance });
        currentUserPointsBalance = finalCalculatedPointsBalance;
        if (userPointsBalanceLabel) userPointsBalanceLabel.textContent = currentUserPointsBalance.toLocaleString('vi-VN');
      }

      const calculatedLoyaltyPointsEarned = Math.floor(finalCashToPay / 10000);
      let enrichedItemsPayload = await enrichCartItemsWithCategories(localCartItems);

      if (activeCampaignData && activeCampaignData.type === "buy_x_get_y" && selectedGiftPayload) {
        enrichedItemsPayload.push({
          id: selectedGiftPayload.id,
          name: `[QUÀ TẶNG] ${selectedGiftPayload.name}`,
          image: selectedGiftPayload.image,
          size: selectedGiftPayload.size,
          quantity: selectedGiftPayload.quantity,
          price: selectedGiftPayload.customerPay, 
          subCategoryName: "Quà tặng đính kèm",
          isGift: true
        });
      }

      const newOrderPayload = {
        userId: currentUserAccount.uid,
        customerName: txtFullName.value,
        phone: txtPhone.value,
        address: shipAddress, 
        deliverySchedule: finalScheduleString,
        items: enrichedItemsPayload, 
        subtotalCash: sumTotalCashBeforeDiscount,
        shippingFee: calculatedShippingFee,
        discountAmount: activeDiscountValue,
        totalCashPaid: finalCashToPay,
        totalPointsDeducted: sumTotalPointsRequired,
        loyaltyPoints: calculatedLoyaltyPointsEarned, 
        isPointsRewarded: false,                    
        status: "Pending",
        couponCodeUsed: activeCampaignData ? activeCampaignData.code : "",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "orders"), newOrderPayload);

      localStorage.removeItem("highlands_cart");
      localCartItems = [];
      activeCampaignData = null;
      selectedGiftPayload = null;
      
      if (giftSelectionZone) giftSelectionZone.style.display = "none";
      if (couponInput) couponInput.value = "";
      
      alert("Chúc mừng! Đơn hàng của bạn đã được gửi lên hệ thống Highlands thành công.");
      
      if (checkoutWorkspaceBlock) checkoutWorkspaceBlock.style.display = "none";
      if (orderHistoryWorkspaceBlock) orderHistoryWorkspaceBlock.style.display = "block";
      fetchUserOrdersHistory();
    } catch (err) {
      console.error(err);
      btnSubmitOrder.removeAttribute("disabled");
      btnSubmitOrder.innerHTML = `<i class="fa-solid fa-check-to-slot"></i> XÁC NHẬN ĐẶT HÀNG & ĐỔI ĐIỂM`;
    }
  };
}

/* =======================================================
   TRUY VẤN LỊCH SỬ ĐƠN HÀNG ĐÃ ĐẶT
======================================================= */
async function fetchUserOrdersHistory() {
  if (!currentUserAccount || !orderHistoryTbody) return;

  try {
    const queryOrders = query(collection(db, "orders"), where("userId", "==", currentUserAccount.uid));
    const snapshotData = await getDocs(queryOrders);
    let listOrders = [];
    snapshotData.forEach(docItem => { listOrders.push({ id: docItem.id, ...docItem.data() }); });

    listOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (localCartItems.length === 0 && listOrders.length > 0) {
      if (checkoutWorkspaceBlock) checkoutWorkspaceBlock.style.display = "none";
      if (orderHistoryWorkspaceBlock) orderHistoryWorkspaceBlock.style.display = "block";
    }

    if (listOrders.length === 0) {
      orderHistoryTbody.innerHTML = `<tr><td colspan="6" class="center-td-msg">Chưa có đơn hàng nào được đặt.</td></tr>`;
      return;
    }

    let tbodyHTML = "";
    listOrders.forEach(order => {
      const textMonAn = order.items.map(m => {
        const sizeInfo = m.size ? ` [Size ${m.size.toUpperCase()}]` : "";
        return `• ${m.name}${sizeInfo} (x${m.quantity})`;
      }).join("<br>");

      let cssStatus = "pending";
      let textStatus = "Chờ xử lý";

      if (order.status === "Preparing") { cssStatus = "preparing"; textStatus = "Đang chuẩn bị"; }
      else if (order.status === "Delivering") { cssStatus = "delivering"; textStatus = "Đang giao"; }
      else if (order.status === "Completed") { cssStatus = "completed"; textStatus = "Hoàn tất"; }
      else if (order.status === "Cancelled") { cssStatus = "cancelled"; textStatus = "Đã hủy"; }

      tbodyHTML += `
        <tr>
          <td class="order-code-id">#${order.id.substring(0, 7).toUpperCase()}</td>
          <td class="order-time-schedule">${order.deliverySchedule}</td>
          <td class="order-items-cell-list">${textMonAn}</td>
          <td class="order-cost-val font-bold-style">${Number(order.totalCashPaid || 0).toLocaleString('vi-VN')} đ</td>
          <td class="order-point-val font-bold-style">${(order.totalPointsDeducted || 0).toLocaleString('vi-VN')} P</td>
          <td><span class="status-badge-element ${cssStatus}">${textStatus}</span></td>
        </tr>
      `;
    });
    orderHistoryTbody.innerHTML = tbodyHTML;
  } catch (error) {
    console.error(error);
  }
}

setupCartModule();