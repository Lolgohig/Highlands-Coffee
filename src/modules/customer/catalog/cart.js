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

// Vùng hiển thị chọn quà (Dùng chung cho Campaign BuyXGetY và Đặc quyền hạng Diamond)
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
let currentUserPointsBalance = 0; // Ánh xạ vào loyaltyPoints của tài khoản
let userMembershipLevel = "Bronze"; 

// Biến trạng thái Core xử lý Ưu đãi & Quà tặng
let activeCampaignData = null;
let selectedGiftPayload = null; 
let diamondGiftPayload = null; 

let sumTotalCashBeforeDiscount = 0;
let sumTotalPointsRequired = 0;
let finalCashToPay = 0;
let activeDiscountValue = 0; 
let membershipDiscountValue = 0; 
let calculatedShippingFee = 0;
let computedDistanceKm = 0;

/* =======================================================
   TỰ ĐỘNG KHỞI TẠO DOM GIAO DIỆN PHỤ TRỢ
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
   ĐỒNG BỘ ACCOUNT & LOAD MEMBERSHIP LEVEL
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
    
    if (data.role !== "user") {
      window.location.href = "auth.html";
      return;
    }

    if (navbarAvatar) navbarAvatar.src = data.avatar || "https://i.pravatar.cc/150";
    if (txtFullName) txtFullName.value = data.fullName || data.name || "Khách Hàng Highlands";
    if (txtPhone) txtPhone.value = data.phone || "Chưa cập nhật SĐT";
    
    userMembershipLevel = data.membershipLevel || data.membership || "Bronze";

    await initFallbackGeoData();

    if (txtAddress && data.address) {
      txtAddress.value = data.address;
      updateShippingWorkflow();
    }

    // Đọc chính xác trường loyaltyPoints từ Database như trong ảnh image_4097ed.jpg
    currentUserPointsBalance = data.loyaltyPoints !== undefined ? data.loyaltyPoints : (data.points || 0);
    if (userPointsBalanceLabel) {
      userPointsBalanceLabel.textContent = currentUserPointsBalance.toLocaleString('vi-VN');
    }
    
    setupCartModule();
  } catch (err) {
    console.error(err);
  }
});

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      window.location.href = "auth.html";
    } catch (err) {
      console.error(err);
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
   QUẢN LÝ RENDER GIỎ HÀNG & CHÍNH SÁCH RANK
======================================================= */
function setupCartModule() {
  loadMegaMenu();
  setupDeliveryTimeToggle();
  
  localCartItems = JSON.parse(localStorage.getItem("highlands_cart")) || [];
  
  if (userMembershipLevel.toLowerCase().trim() === "diamond" && localCartItems.length > 0) {
    renderDiamondCakeSelection();
  }

  renderCartSummaryUI();

  if (txtAddress) {
    txtAddress.addEventListener("change", updateShippingWorkflow);
  }
  attachCouponEngine();
  attachOrderSubmission();
  fetchUserOrdersHistory();
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
    // Check xem sản phẩm thuộc nhóm quy đổi điểm hay không
    const isPointProduct = item.pointsRequired > 0 || item.category === "sản phẩm sử dụng điểm" || item.categoryName === "Sản phẩm sử dụng điểm";
    const singlePrice = isPointProduct ? 0 : (Number(item.price) || 0);
    const singlePoints = isPointProduct ? (Number(item.pointsRequired) || 0) : 0;

    sumTotalCashBeforeDiscount += singlePrice * (item.quantity || 1);
    sumTotalPointsRequired += singlePoints * (item.quantity || 1);

    const textDisplayPrice = isPointProduct 
      ? `<span class="point-badge-cost">${singlePoints.toLocaleString('vi-VN')} Điểm / món</span>`
      : `<span>${singlePrice.toLocaleString('vi-VN')} đ</span>`;

    // Kiểm tra quyền hiển thị Size: Chỉ cho phép hiển thị size nếu là Cà phê, Trà, hoặc Freeze
    const catNameLower = (item.categoryName || item.category || "").toLowerCase();
    const canHaveSize = catNameLower.includes("cà phê") || catNameLower.includes("trà") || catNameLower.includes("freeze");
    const sizeMetaText = (canHaveSize && item.size) ? `Size: <strong>${item.size}</strong> | ` : "";

    itemsHtml += `
      <div class="summary-product-item-row">
        <img src="${item.image || 'https://www.highlandscoffee.com.vn/vnt_upload/product/04_2023/PRODUCT/(H)_PHIN_SUA_DA.png'}" alt="${item.name}" />
        <div class="item-middle-details">
          <div class="item-title-name">${item.name}</div>
          <div class="item-meta-info">${sizeMetaText}SL: <strong>${item.quantity}</strong></div>
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

/* HÀM ĐẶC QUYỀN RANK DIAMOND: TẶNG BÁNH NGỌT (KHÔNG CÓ SIZE) */
async function renderDiamondCakeSelection() {
  if (!giftSelectionZone) return;
  giftSelectionZone.innerHTML = "🔄 Đang tải danh sách bánh ngọt đặc quyền cho hạng Diamond...";
  giftSelectionZone.style.display = "block";

  try {
    const prodSnapshot = await getDocs(collection(db, "products"));
    let cakeGifts = [];

    prodSnapshot.forEach(pDoc => {
      const pData = pDoc.data();
      if (pData.status !== "in-stock") return;

      const isTargetCategory = (pData.categoryId === "L40Vp8L02zWzj0AhwYGd" || pData.category === "L40Vp8L02zWzj0AhwYGd");
      const isTargetSubCategory = (pData.subCategoryId === "sub_1780723320799dbgfp" || pData.subCategory === "sub_1780723320799dbgfp" || (pData.subCategoryName && pData.subCategoryName.includes("Bánh Ngọt")));

      if (isTargetCategory && isTargetSubCategory) {
        cakeGifts.push({ id: pDoc.id, ...pData });
      }
    });

    if (cakeGifts.length === 0) {
      giftSelectionZone.innerHTML = `<p style="color:#7b001f;">💎 Bạn là thành viên <strong>Diamond</strong>! Tuy nhiên hệ thống không tìm thấy bánh ngọt quà tặng khả dụng.</p>`;
      return;
    }

    giftSelectionZone.innerHTML = `
      <h4 style="color:#7b001f; margin-bottom:10px;"><i class="fa-solid fa-gem"></i> ĐẶC QUYỀN DIAMOND: TẶNG 1 BÁNH NGỌT TUẦN SINH NHẬT</h4>
      <div class="input-group">
        <label style="font-size:14px; font-weight:600; color:#333;">Chọn loại bánh ngọt bạn yêu thích:</label>
        <select id="diamond-cake-select" class="form-control" style="margin-top:5px;">
          ${cakeGifts.map(cake => `
            <option value="${cake.id}" data-name="${cake.name}" data-img="${cake.image || ''}">
              ${cake.name} (Miễn phí 100%)
            </option>
          `).join("")}
        </select>
      </div>
    `;

    const diamondCakeSelect = document.getElementById("diamond-cake-select");
    const updateDiamondGiftPayload = () => {
      const selectedOpt = diamondCakeSelect.options[diamondCakeSelect.selectedIndex];
      diamondGiftPayload = {
        id: diamondCakeSelect.value,
        name: selectedOpt.dataset.name,
        image: selectedOpt.dataset.img,
        quantity: 1,
        isGiftItem: true,
        customerPay: 0,
        giftType: "DiamondBirthdayBenefit"
      };
    };

    diamondCakeSelect.onchange = updateDiamondGiftPayload;
    updateDiamondGiftPayload();

  } catch (err) {
    console.error("Lỗi xử lý tải bánh ngọt hạng Diamond:", err);
  }
}

/* HÀM TÍNH TOÁN TỶ LỆ GIẢM THEO CHÍNH SÁCH THÀNH VIÊN */
function getMembershipDiscountRate(level) {
  const lvl = (level || "").toLowerCase().trim();
  if (lvl.includes("bronze")) return 0.01;   
  if (lvl.includes("iron")) return 0.03;     
  if (lvl.includes("gold")) return 0.05;     
  if (lvl.includes("diamond")) return 0.05;  
  if (lvl.includes("platinum")) return 0.10; 
  return 0; 
}

function calculateFinalLedgerBalances() {
  if (computedDistanceKm > 50) {
    disableCheckoutFormDueToDistance();
    return;
  }

  activeDiscountValue = 0;
  membershipDiscountValue = 0;
  let campaignGiftSurcharge = 0; 

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
        campaignGiftSurcharge = selectedGiftPayload.customerPay || 0;
      }
    }
  }

  const memberRate = getMembershipDiscountRate(userMembershipLevel);
  if (memberRate > 0) {
    membershipDiscountValue = Math.floor(sumTotalCashBeforeDiscount * memberRate);
  }

  const totalCombinedDiscount = activeDiscountValue + membershipDiscountValue;
  const finalDiscountApplied = Math.min(sumTotalCashBeforeDiscount, totalCombinedDiscount);

  finalCashToPay = Math.max(0, sumTotalCashBeforeDiscount - finalDiscountApplied) + calculatedShippingFee + campaignGiftSurcharge;

  if (ledgerSubtotalCash) ledgerSubtotalCash.textContent = `${sumTotalCashBeforeDiscount.toLocaleString('vi-VN')} đ`;
  if (ledgerShippingFee) ledgerShippingFee.textContent = `${calculatedShippingFee.toLocaleString('vi-VN')} đ`;
  
  if (ledgerDiscount) {
    if (membershipDiscountValue > 0) {
      ledgerDiscount.innerHTML = `${finalDiscountApplied.toLocaleString('vi-VN')} đ <br/><small style="font-size:11px; color:#2e7d32; font-weight:normal;">(Cộng dồn hạng thẻ ${userMembershipLevel}: -${membershipDiscountValue.toLocaleString('vi-VN')}đ)</small>`;
    } else {
      ledgerDiscount.textContent = `-${finalDiscountApplied.toLocaleString('vi-VN')} đ`;
    }
  }
  
  if (ledgerTotalCash) {
    if (campaignGiftSurcharge > 0) {
      ledgerTotalCash.innerHTML = `${finalCashToPay.toLocaleString('vi-VN')} đ <small style="font-size:11px; color:#7b001f; font-weight:bold;">(Đã gồm +${campaignGiftSurcharge.toLocaleString('vi-VN')}đ nâng size quà)</small>`;
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
   MÃ GIẢM GIÁ CAMPAIGN ENGINE
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
        if (userMembershipLevel.toLowerCase().trim() !== "diamond" && giftSelectionZone) {
          giftSelectionZone.style.display = "none";
        }
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
        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = `🟢 Áp dụng thành công: Chiến dịch giảm giá ${campaignDocData.discountPercent}% (Được áp dụng cộng dồn với hạng thành viên).`;
          couponFeedbackMsg.className = "coupon-status-msg success";
        }
        calculateFinalLedgerBalances();
      } 
      else if (campaignDocData.type === "flat_amount") {
        activeCampaignData = campaignDocData;
        selectedGiftPayload = null;
        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = `🟢 Áp dụng thành công: Khấu trừ thẳng ${(campaignDocData.discountFlatValue || 0).toLocaleString('vi-VN')}đ vào hóa đơn.`;
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
          if (couponFeedbackMsg) {
            couponFeedbackMsg.textContent = `⚠️ Giỏ hàng chưa đạt điều kiện! Chiến dịch yêu cầu mua tối thiểu ${requiredX} món thuộc danh mục quy định.`;
            couponFeedbackMsg.className = "coupon-status-msg error";
          }
          calculateFinalLedgerBalances();
          return;
        }

        activeCampaignData = campaignDocData;
        if (couponFeedbackMsg) {
          couponFeedbackMsg.textContent = `🟢 Đạt điều kiện: Mã ưu đãi [Mua ${campaignDocData.buyQty} Tặng ${campaignDocData.getQty}]. Vui lòng chọn quà tặng Campaign!`;
          couponFeedbackMsg.className = "coupon-status-msg success";
        }
        await renderCampaignGiftSelection(campaignDocData);
      }
    } catch (error) {
      console.error("Lỗi xử lý Engine mã ưu đãi:", error);
    }
  };
}

async function renderCampaignGiftSelection(campaignData) {
  let existingGiftContainer = document.getElementById("campaign-gift-sub-wrapper");
  if (existingGiftContainer) existingGiftContainer.remove();

  const subWrapper = document.createElement("div");
  subWrapper.id = "campaign-gift-sub-wrapper";
  subWrapper.style.cssText = "margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ccc;";

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
        if (campaignData.getCategories.includes(prodCategoryId) && campaignData.getSubCategories.includes(prodSubCategoryId)) isMatch = true;
      } else if (hasSubFilter) {
        if (campaignData.getSubCategories.includes(prodSubCategoryId)) isMatch = true;
      } else if (hasCatFilter) {
        if (campaignData.getCategories.includes(prodCategoryId)) isMatch = true;
      } else {
        isMatch = true;
      }

      if (isMatch) eligibleGifts.push({ id: pDoc.id, ...pData });
    });

    if (eligibleGifts.length === 0) {
      subWrapper.innerHTML = `<p style="color:#e53935;">⚠️ Không có quà tặng Campaign phù hợp cấu hình.</p>`;
      giftSelectionZone.appendChild(subWrapper);
      return;
    }

    subWrapper.innerHTML = `
      <h5 style="color:#2e7d32; margin-bottom:8px;"><i class="fa-solid fa-gift"></i> CHỌN QUÀ TẶNG TỪ MÃ CAMPAIGN:</h5>
      <select id="campaign-gift-select" class="form-control" style="margin-bottom:10px;">
        ${eligibleGifts.map(g => `
          <option value="${g.id}" data-name="${g.name}" data-img="${g.image || ''}" data-categoryid="${g.categoryId || g.category || ''}" data-categoryname="${g.categoryName || ''}">
            ${g.name}
          </option>
        `).join("")}
      </select>
      <div style="display:flex; gap:15px; margin-top:5px;" id="campaign-gift-size-wrapper">
        <label><input type="radio" name="camp-size" value="S" checked> Size S (Free)</label>
        <label><input type="radio" name="camp-size" value="M"> Size M (+6k)</label>
        <label><input type="radio" name="camp-size" value="L"> Size L (+6k)</label>
      </div>
    `;
    giftSelectionZone.appendChild(subWrapper);
    giftSelectionZone.style.display = "block";

    const compSelect = document.getElementById("campaign-gift-select");
    const compRadios = document.querySelectorAll('input[name="camp-size"]');

    const recalculateCampGift = () => {
      const opt = compSelect.options[compSelect.selectedIndex];
      const targetCatName = (opt.dataset.categoryname || "").toLowerCase();

      // CHUẨN HOÁ QUYỀN CHỌN SIZE: Chỉ "cà phê", "trà", "freeze" mới hiển thị size
      const isDrinkWithSizes = targetCatName.includes("cà phê") || targetCatName.includes("trà") || targetCatName.includes("freeze");
      
      if (isDrinkWithSizes) {
        document.getElementById("campaign-gift-size-wrapper").style.display = "flex";
        const size = document.querySelector('input[name="camp-size"]:checked')?.value || "S";
        selectedGiftPayload = {
          id: compSelect.value,
          name: opt.dataset.name,
          image: opt.dataset.img,
          size: size,
          quantity: campaignData.getQty || 1,
          isGiftItem: true,
          customerPay: (size === "M" || size === "L") ? 6000 : 0
        };
      } else {
        // Nếu là bánh ngọt, sản phẩm dùng điểm, merchandise... -> Ẩn hoàn toàn chọn size
        document.getElementById("campaign-gift-size-wrapper").style.display = "none";
        selectedGiftPayload = {
          id: compSelect.value,
          name: opt.dataset.name,
          image: opt.dataset.img,
          quantity: campaignData.getQty || 1,
          isGiftItem: true,
          customerPay: 0
        };
      }
      calculateFinalLedgerBalances();
    };

    compSelect.onchange = recalculateCampGift;
    compRadios.forEach(r => r.onchange = recalculateCampGift);
    recalculateCampGift();

  } catch (err) {
    console.error(err);
  }
}

async function enrichCartItemsWithCategories(cartItems) {
  if (!cartItems || cartItems.length === 0) return [];
  return Promise.all(cartItems.map(async (item) => {
    try {
      const productSnap = await getDoc(doc(db, "products", item.id));
      if (productSnap.exists()) {
        const prodData = productSnap.data();
        return {
          ...item,
          parentCategoryId: prodData.category || prodData.categoryId || "",
          subCategoryId: prodData.subCategory || prodData.subCategoryId || ""
        };
      }
    } catch (err) {
      console.error(err);
    }
    return { ...item, parentCategoryId: "", subCategoryId: "" };
  }));
}

/* =======================================================
   CẤU HÌNH THỜI GIAN NHẬN HÀNG
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
   ALGORITHM TÍNH KHOẢNG CÁCH SHIP HÀNG
======================================================= */
function computeHaversineInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
}

async function fetchCoordinatesViaOSM(addressString) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}&limit=1`, {
      headers: { "User-Agent": "HighlandsCoffeeDeliveryApp/2.0" }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    return null;
  }
}

function cleanAdministrativeString(str) {
  return str.replace(/Tỉnh|Thành phố|Quận|Huyện|Phường|Xã|Thị xã/gi, "").replace(/\s+/g, " ").trim();
}

async function updateShippingWorkflow() {
  const originalAddress = txtAddress ? txtAddress.value.trim() : "";
  let coords = null;

  if (originalAddress.length >= 8) {
    const addressParts = originalAddress.split(",").map(part => part.trim());
    let cleanAddressForAPI = originalAddress;
    if (addressParts.length >= 3) {
      cleanAddressForAPI = addressParts.slice(-3).join(", ");
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
      coords = await fetchCoordinatesViaOSM(`${cleanAdministrativeString(wardText)}, ${cleanAdministrativeString(distText)}, ${cleanAdministrativeString(provText)}`);
    }
  } else {
    if (fallbackGeoWrapper) fallbackGeoWrapper.style.display = "none";
  }

  if (coords) {
    computedDistanceKm = computeHaversineInKm(SHOP_LAT, SHOP_LNG, coords.lat, coords.lng) * 1.3;
    if (computedDistanceKm > 50) {
      calculatedShippingFee = 0;
      if (shippingDistanceText) shippingDistanceText.textContent = `${computedDistanceKm.toFixed(1)} km (Quá xa)`;
      disableCheckoutFormDueToDistance();
      return;
    }
    calculatedShippingFee = computedDistanceKm <= 3 ? 15000 : 15000 + Math.floor((computedDistanceKm - 3) * 5000);
    if (shippingDistanceText) shippingDistanceText.textContent = `${computedDistanceKm.toFixed(1)} km`;
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

async function initFallbackGeoData() {
  if (!selectProvince) return;
  try {
    const res = await fetch("https://provinces.open-api.vn/api/?depth=3");
    const data = await res.json();
    selectProvince.innerHTML = `<option value="">-- Chọn Tỉnh/TP --</option>` + data.map(p => `<option value="${p.code}">${p.name}</option>`).join("");
    selectProvince.onchange = () => {
      const foundP = data.find(p => p.code == selectProvince.value);
      if (foundP && selectDistrict) {
        selectDistrict.innerHTML = `<option value="">-- Chọn Quận/Huyện --</option>` + foundP.districts.map(d => `<option value="${d.code}">${d.name}</option>`).join("");
        if (selectWard) selectWard.innerHTML = `<option value="">-- Chọn Phường/Xã --</option>`;
      }
      updateShippingWorkflow();
    };
    if (selectDistrict) {
      selectDistrict.onchange = () => {
        const foundP = data.find(p => p.code == selectProvince.value);
        if (foundP) {
          const foundD = foundP.districts.find(d => d.code == selectDistrict.value);
          if (foundD && selectWard) {
            selectWard.innerHTML = `<option value="">-- Chọn Phường/Xã --</option>` + foundD.wards.map(w => `<option value="${w.code}">${w.name}</option>`).join("");
          }
        }
        updateShippingWorkflow();
      };
    }
    if (selectWard) selectWard.onchange = updateShippingWorkflow;
  } catch (err) {
    console.error(err);
  }
}

/* =======================================================
   SUBMIT ORDER & KẾT XUẤT LÊN FIRESTORE
======================================================= */
function attachOrderSubmission() {
  if (!btnSubmitOrder) return;
  btnSubmitOrder.onclick = async () => {
    if (localCartItems.length === 0) return;

    // THÔNG BÁO VÀ CHẶN ĐẶT HÀNG NẾU KHÔNG ĐỦ LOYALTY POINTS (Giữ nguyên logic gốc của bạn)
    if (currentUserPointsBalance < sumTotalPointsRequired) {
      alert(`⚠️ Không đủ điểm đổi quà! Bạn hiện có ${currentUserPointsBalance.toLocaleString('vi-VN')} loyaltyPoints. Đơn hàng yêu cầu ${sumTotalPointsRequired.toLocaleString('vi-VN')} điểm.`);
      return;
    }

    const name = txtFullName ? txtFullName.value.trim() : "";
    const phone = txtPhone ? txtPhone.value.trim() : "";
    const address = txtAddress ? txtAddress.value.trim() : "";

    if (!name || !phone || !address || phone.includes("Chưa cập nhật")) {
      alert("⚠️ Vui lòng cung cấp đầy đủ thông tin giao hàng.");
      return;
    }

    const checkedTimeRadio = document.querySelector('input[name="delivery-time-type"]:checked');
    let finalDeliveryTimeText = "Giao ngay lập tức (Càng sớm càng tốt)";
    if (checkedTimeRadio && checkedTimeRadio.value === "custom") {
      const dVal = dateDelivery?.value;
      const tVal = timeDelivery?.value;
      if (!dVal || !tVal) {
        alert("⚠️ Vui lòng chọn cụ thể Ngày và Giờ muốn nhận hàng.");
        return;
      }
      finalDeliveryTimeText = `${tVal} ngày ${dVal}`;
    }

    btnSubmitOrder.setAttribute("disabled", "true");
    btnSubmitOrder.textContent = "⌛ ĐANG XỬ LÝ ĐƠN HÀNG...";

    try {
      let finalItemsPayload = [...localCartItems];
      if (activeCampaignData && activeCampaignData.type === "buy_x_get_y" && selectedGiftPayload) {
        finalItemsPayload.push(selectedGiftPayload);
      }
      if (userMembershipLevel.toLowerCase().trim() === "diamond" && diamondGiftPayload) {
        finalItemsPayload.push(diamondGiftPayload);
      }

      const totalCombinedDiscount = activeDiscountValue + membershipDiscountValue;
      const finalDiscountApplied = Math.min(sumTotalCashBeforeDiscount, totalCombinedDiscount);

      // CƠ CHẾ TÍCH LUỸ ĐIỂM (LOYALTY POINTS): Mỗi 10.000đ hóa đơn tiền mặt = +1 điểm thưởng
      const newEarnedPoints = Math.floor(finalCashToPay / 10000);

      const orderPayload = {
        userId: currentUserAccount.uid,
        customerName: name,
        customerPhone: phone,
        shippingAddress: address,
        deliverySchedule: finalDeliveryTimeText, 
        items: finalItemsPayload,
        subtotalCash: sumTotalCashBeforeDiscount,
        shippingFee: calculatedShippingFee,
        discountPercentFromCampaign: activeCampaignData && activeCampaignData.type === "percentage" ? activeCampaignData.discountPercent : 0,
        membershipLevel: userMembershipLevel, 
        membershipDiscount: membershipDiscountValue, 
        totalDiscount: finalDiscountApplied,
        totalCashPaid: finalCashToPay,
        totalPointsDeducted: sumTotalPointsRequired, 
        earnedPointsFromOrder: newEarnedPoints, 
        distanceKm: computedDistanceKm,
        status: "Pending", 
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "orders"), orderPayload);

      // CẬP NHẬT LẠI VÍ ĐIỂM USER CHÍNH XÁC VÀO TRƯỜNG loyaltyPoints
      const userRef = doc(db, "users", currentUserAccount.uid);
      const finalUpdatedPointsBalance = currentUserPointsBalance - sumTotalPointsRequired + newEarnedPoints;
      
      await updateDoc(userRef, { 
        loyaltyPoints: finalUpdatedPointsBalance 
      });

      localStorage.removeItem("highlands_cart");
      alert(`🎉 Đặt hàng thành công!\n- Bạn đã dùng: ${sumTotalPointsRequired.toLocaleString('vi-VN')} điểm đổi quà.\n- Bạn được tích luỹ thêm: +${newEarnedPoints} loyaltyPoints mới từ hóa đơn.`);
      window.location.reload();

    } catch (error) {
      console.error(error);
      btnSubmitOrder.removeAttribute("disabled");
      btnSubmitOrder.textContent = "TIẾN HÀNH ĐẶT HÀNG";
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
      const textMonAn = (order.items || []).map(m => {
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
          <td class="order-time-schedule">${order.deliverySchedule || "Giao ngay"}</td>
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