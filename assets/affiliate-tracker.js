/**
 * affiliate-tracker.js — Hệ thống Affiliate & Đặt Hàng Trực Tiếp NCTTX
 * Tự động vận hành 100% không qua sàn, ghi dữ liệu về Google Sheets
 */

(function() {
  // ────────────────────────────────────────────────────────
  // CẤU HÌNH HỆ THỐNG
  // ────────────────────────────────────────────────────────
  const CONFIG = {
    // URL Web App của Google Apps Script sau khi Deploy (Extension -> Apps Script -> Deploy)
    // Dán URL Web App thật của bạn vào đây. Dưới đây là URL dự phòng / giả định.
    API_URL: 'https://script.google.com/macros/s/AKfycbz_example_web_app_url/exec',
    API_SECRET: 'NCTTX_secret_2024',
    
    // Thông tin tài khoản ngân hàng example để sinh mã VietQR tự động
    BANK: {
      ID: 'mbbank',            // Mã ngân hàng MB Bank
      ACC_NO: '0901234567',    // Số tài khoản example
      NAME: 'VO THANH LUAN',  // Tên chủ tài khoản
      TEMPLATE: 'qr_only'      // Template VietQR (qr_only, compact, print)
    },
    
    // Cookie/Storage expiration: 30 ngày
    COOKIE_EXPIRE_DAYS: 30
  };

  // ────────────────────────────────────────────────────────
  // 1. TRACKING MÃ GIỚI THIỆU (?ref=...)
  // ────────────────────────────────────────────────────────
  function parseAndSaveRef() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      const now = new Date().getTime();
      localStorage.setItem('NCTTX_affiliate_ref', refCode.trim());
      localStorage.setItem('NCTTX_affiliate_ref_time', now.toString());
      
      // Dọn dẹp tham số ?ref trên URL để link trông sạch sẽ hơn mà không reload trang
      urlParams.delete('ref');
      const newQuery = urlParams.toString();
      const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '') + window.location.hash;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      console.log('✓ NCTTX Affiliate: Đã ghi nhận đối tác giới thiệu:', refCode);
    }
  }

  // Lấy mã ref còn hạn sử dụng
  function getActiveRef() {
    const ref = localStorage.getItem('NCTTX_affiliate_ref');
    const time = localStorage.getItem('NCTTX_affiliate_ref_time');
    
    if (!ref || !time) return '';
    
    const now = new Date().getTime();
    const elapsedDays = (now - parseInt(time)) / (24 * 3600 * 1000);
    
    if (elapsedDays > CONFIG.COOKIE_EXPIRE_DAYS) {
      // Đã quá hạn 30 ngày -> xóa
      localStorage.removeItem('NCTTX_affiliate_ref');
      localStorage.removeItem('NCTTX_affiliate_ref_time');
      return '';
    }
    
    return ref;
  }

  // ────────────────────────────────────────────────────────
  // 2. TẠO CẤU TRÚC MODAL ĐẶT HÀNG TRÊN TRANG (DYNAMIC DOM)
  // ────────────────────────────────────────────────────────
  let activeProducts = [];
  
  // Xác định dòng sản phẩm mặc định dựa trên loại trang
  function detectPageProduct() {
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    if (title.includes('nước hoa') || url.includes('nuoc-hoa')) {
      return [
        { sku: 'perfume-dalat-30ml', name: 'Nước hoa Đà Lạt Sau Cơn Mưa (30ml)', price: 1200000, qty: 1 }
      ];
    } else if (url.includes('1ml') || url.includes('qr')) {
      return [
        { sku: 'tinh-dau-1ml', name: 'Tinh Dầu 1ml Trải Nghiệm', price: 10000, qty: 1 }
      ];
    } else {
      // Default tinh dầu
      return [
        { sku: 'tinh-dau-sa-chanh-10ml', name: 'Tinh Dầu Sả Chanh (10ml)', price: 180000, qty: 1 },
        { sku: 'tinh-dau-oai-huong-10ml', name: 'Tinh Dầu Oải Hương (10ml)', price: 270000, qty: 1 },
        { sku: 'nen-thom-100g', name: 'Nến Thơm Cao Cấp (100g)', price: 150000, qty: 1 }
      ];
    }
  }

  // Chèn CSS cho Modal vào <head>
  function injectStyles() {
    const css = `
      .ncttx-modal-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(15, 43, 30, 0.6); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; visibility: hidden; transition: all 0.35s ease;
        padding: 16px; font-family: 'Be Vietnam Pro', system-ui, sans-serif;
      }
      .ncttx-modal-overlay.show { opacity: 1; visibility: visible; }
      .ncttx-modal {
        background: #F5F2EB; border: 2px solid #D0CBC0; border-radius: 20px;
        width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 50px rgba(15, 43, 30, 0.25);
        position: relative; transform: translateY(30px); transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.15);
      }
      .ncttx-modal-overlay.show .ncttx-modal { transform: translateY(0); }
      .ncttx-modal-header {
        background: #1B4332; color: #FEFAE0; padding: 20px 24px;
        position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between;
      }
      .ncttx-modal-header h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 600; margin: 0; }
      .ncttx-modal-close {
        background: rgba(255,255,255,0.1); border: none; color: #FEFAE0; font-size: 1.5rem;
        cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      }
      .ncttx-modal-close:hover { background: rgba(255,255,255,0.2); }
      .ncttx-modal-body { padding: 24px; color: #1A2C1E; }
      
      /* Form fields */
      .ncttx-form-group { margin-bottom: 16px; }
      .ncttx-label { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #5A7060; margin-bottom: 6px; }
      .ncttx-input, .ncttx-textarea {
        width: 100%; border: 1.5px solid #D0CBC0; border-radius: 10px; padding: 11px 14px;
        font-size: 14px; outline: none; background: #FFFFFF; font-family: inherit; color: #1A2C1E; transition: all 0.2s;
      }
      .ncttx-input:focus, .ncttx-textarea:focus { border-color: #2D6A4F; box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.12); }
      
      /* Product Selector */
      .ncttx-product-box {
        border: 1.5px solid #D0CBC0; border-radius: 14px; background: #FFFFFF; padding: 14px; margin-bottom: 20px;
      }
      .ncttx-prod-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #EDEAE3; }
      .ncttx-prod-item:last-child { border-bottom: none; }
      .ncttx-prod-name { font-size: 13px; font-weight: 700; color: #1A2C1E; }
      .ncttx-prod-price { font-size: 12px; color: #C9963A; font-weight: 700; margin-top: 2px; }
      .ncttx-qty-wrap { display: flex; align-items: center; gap: 8px; }
      .ncttx-qty-btn {
        width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #D0CBC0; background: #F5F2EB;
        font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;
      }
      .ncttx-qty-btn:active { background: #EDEAE3; }
      .ncttx-qty-val { font-size: 14px; font-weight: 700; min-width: 20px; text-align: center; }
      
      /* Total & Checkout */
      .ncttx-total-box {
        display: flex; align-items: center; justify-content: space-between;
        margin-top: 18px; padding-top: 16px; border-top: 1.5px solid #D0CBC0;
      }
      .ncttx-total-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #5A7060; }
      .ncttx-total-val { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; font-weight: 700; color: #1B4332; }
      
      .ncttx-btn-submit {
        width: 100%; background: #1B4332; color: #FEFAE0; border: none; border-radius: 12px; padding: 14px;
        font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;
        transition: all 0.2s; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 8px;
      }
      .ncttx-btn-submit:hover { background: #2D6A4F; }
      .ncttx-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
      
      /* Success View */
      .ncttx-success-view { text-align: center; display: none; padding: 20px 0; }
      .ncttx-success-icon { font-size: 3rem; color: #2D6A4F; margin-bottom: 16px; }
      .ncttx-success-title { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 600; color: #1B4332; margin-bottom: 10px; }
      .ncttx-success-desc { font-size: 14px; color: #5A7060; margin-bottom: 24px; }
      
      /* QR Code Block */
      .ncttx-qr-box {
        background: #FFFFFF; border: 1.5px solid #D0CBC0; border-radius: 16px; padding: 20px;
        margin: 20px auto; max-width: 280px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      }
      .ncttx-qr-img { width: 100%; height: auto; display: block; border-radius: 8px; }
      .ncttx-qr-lbl { font-size: 11px; font-weight: 700; color: #C9963A; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
      .ncttx-qr-acc { font-size: 11px; color: #5A7060; margin-top: 4px; font-family: monospace; }
      
      .ncttx-btn-zalo-confirm {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; background: #0068FF; color: #FFFFFF; text-decoration: none; border-radius: 12px;
        padding: 14px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
        transition: all 0.22s; box-shadow: 0 4px 15px rgba(0,104,255,0.2); margin-top: 10px;
      }
      .ncttx-btn-zalo-confirm:hover { background: #0054CC; transform: translateY(-1px); }
    `;
    const styleEl = document.createElement('style');
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);
  }

  // Tạo và chèn DOM Modal
  function createModalDOM() {
    activeProducts = detectPageProduct();
    
    const overlay = document.createElement('div');
    overlay.className = 'ncttx-modal-overlay';
    overlay.id = 'ncttxOrderModalOverlay';
    
    let prodItemsHTML = '';
    activeProducts.forEach((p, idx) => {
      prodItemsHTML += `
        <div class="ncttx-prod-item" data-idx="${idx}">
          <div>
            <div class="ncttx-prod-name">${p.name}</div>
            <div class="ncttx-prod-price">${p.price.toLocaleString('vi-VN')} đ</div>
          </div>
          <div class="ncttx-qty-wrap">
            <button type="button" class="ncttx-qty-btn dec" onclick="window.ncttxChangeQty(${idx}, -1)">−</button>
            <span class="ncttx-qty-val" id="ncttxQtyVal-${idx}">${p.qty}</span>
            <button type="button" class="ncttx-qty-btn inc" onclick="window.ncttxChangeQty(${idx}, 1)">+</button>
          </div>
        </div>
      `;
    });

    const activeRef = getActiveRef();
    const partnerBadgeHTML = activeRef 
      ? `<div style="background:#FEF3C7; color:#B45309; font-size:11px; font-weight:700; padding:6px 12px; border-radius:6px; margin-bottom:16px; text-align:center;">
          ✦ Mã giới thiệu: <code>${activeRef}</code> (Được giảm giá/nhận thêm mẫu thử quà tặng)
         </div>`
      : '';

    overlay.innerHTML = `
      <div class="ncttx-modal">
        <div class="ncttx-modal-header">
          <h3>Đặt Hàng Trực Tiếp</h3>
          <button class="ncttx-modal-close" id="ncttxModalCloseBtn">&times;</button>
        </div>
        
        <div class="ncttx-modal-body">
          <!-- VIEW 1: FORM NHẬP LIỆU -->
          <div id="ncttxFormView">
            ${partnerBadgeHTML}
            
            <div class="ncttx-form-group">
              <label class="ncttx-label">Sản Phẩm Đặt Mua</label>
              <div class="ncttx-product-box">
                ${prodItemsHTML}
              </div>
            </div>
            
            <form id="ncttxCheckoutForm" onsubmit="window.ncttxSubmitOrder(event)">
              <div class="ncttx-form-group">
                <label class="ncttx-label" for="ncttx-name">Họ và Tên người nhận</label>
                <input type="text" class="ncttx-input" id="ncttx-name" required placeholder="Ví dụ: Nguyễn Văn A">
              </div>
              
              <div class="ncttx-form-group">
                <label class="ncttx-label" for="ncttx-phone">Số điện thoại</label>
                <input type="tel" class="ncttx-input" id="ncttx-phone" required placeholder="Ví dụ: 0901234567">
              </div>
              
              <div class="ncttx-form-group">
                <label class="ncttx-label" for="ncttx-addr">Địa chỉ giao hàng chi tiết</label>
                <textarea class="ncttx-textarea" id="ncttx-addr" required rows="2" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh thành..."></textarea>
              </div>
              
              <div class="ncttx-total-box">
                <span class="ncttx-total-lbl">Tổng thanh toán:</span>
                <span class="ncttx-total-val" id="ncttxTotalVal">0 đ</span>
              </div>
              
              <button type="submit" class="ncttx-btn-submit" id="ncttxSubmitBtn">
                🚀 Xác Nhận Đặt Hàng Giao Ngay
              </button>
            </form>
          </div>
          
          <!-- VIEW 2: ĐẶT HÀNG THÀNH CÔNG + VIETQR -->
          <div class="ncttx-success-view" id="ncttxSuccessView">
            <div class="ncttx-success-icon">✓</div>
            <div class="ncttx-success-title">Đặt Hàng Thành Công!</div>
            <div class="ncttx-success-desc" id="ncttxSuccessDesc">
              Chúng mình đã ghi nhận đơn hàng mã <strong>NCTTX-AFF-XXXX</strong> của bạn.
            </div>
            
            <!-- Hộp Chuyển khoản VietQR -->
            <div class="ncttx-qr-box">
              <img class="ncttx-qr-img" id="ncttxQrImg" src="" alt="Mã VietQR thanh toán tự động">
              <div class="ncttx-qr-lbl">Quét mã chuyển khoản nhanh</div>
              <div class="ncttx-qr-acc">${CONFIG.BANK.ID} · ${CONFIG.BANK.ACC_NO}</div>
            </div>
            
            <p style="font-size: 12px; color:#5A7060; margin-bottom: 20px; line-height: 1.6;">
              Sau khi chuyển khoản, bạn có thể click nút xác nhận Zalo dưới đây để nhân sự đóng gói và ship thẳng từ vườn Đà Lạt sớm nhất nhé!
            </p>
            
            <a href="#" target="_blank" class="ncttx-btn-zalo-confirm" id="ncttxZaloConfirmBtn">
              💬 Xác Nhận Nhận Hàng Qua Zalo
            </a>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close events
    document.getElementById('ncttxModalCloseBtn').addEventListener('click', hideModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) hideModal();
    });
    
    updateTotal();
  }

  // Thay đổi số lượng
  window.ncttxChangeQty = function(idx, delta) {
    if (activeProducts[idx]) {
      activeProducts[idx].qty = Math.max(0, activeProducts[idx].qty + delta);
      document.getElementById(`ncttxQtyVal-${idx}`).textContent = activeProducts[idx].qty;
      updateTotal();
    }
  };

  // Tính tổng tiền
  function calculateTotalSum() {
    return activeProducts.reduce((sum, p) => sum + (p.price * p.qty), 0);
  }

  function updateTotal() {
    const total = calculateTotalSum();
    document.getElementById('ncttxTotalVal').textContent = total.toLocaleString('vi-VN') + ' đ';
    const submitBtn = document.getElementById('ncttxSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = (total === 0);
    }
  }

  // Hiển thị modal
  function showModal() {
    // Nếu chưa tạo DOM thì tạo
    if (!document.getElementById('ncttxOrderModalOverlay')) {
      createModalDOM();
    } else {
      // Reset form view
      document.getElementById('ncttxFormView').style.display = 'block';
      document.getElementById('ncttxSuccessView').style.display = 'none';
      document.getElementById('ncttxCheckoutForm').reset();
      activeProducts.forEach((p, idx) => {
        p.qty = 1;
        const el = document.getElementById(`ncttxQtyVal-${idx}`);
        if (el) el.textContent = '1';
      });
      updateTotal();
    }
    
    const overlay = document.getElementById('ncttxOrderModalOverlay');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  // Ẩn modal
  function hideModal() {
    const overlay = document.getElementById('ncttxOrderModalOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  // ────────────────────────────────────────────────────────
  // 3. XỬ LÝ GỬI ĐƠN HÀNG LÊN GOOGLE APPS SCRIPT
  // ────────────────────────────────────────────────────────
  window.ncttxSubmitOrder = function(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('ncttxSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gửi thông tin đơn hàng...';
    
    const name = document.getElementById('ncttx-name').value.trim();
    const phone = document.getElementById('ncttx-phone').value.trim();
    const addr = document.getElementById('ncttx-addr').value.trim();
    const refCode = getActiveRef();
    const total = calculateTotalSum();
    
    // Thu thập danh sách sản phẩm được chọn
    const details = activeProducts
      .filter(p => p.qty > 0)
      .map(p => ({ sku: p.sku, name: p.name, qty: p.qty, price: p.price }));
      
    const postData = {
      secret: CONFIG.API_SECRET,
      action: 'submitAffiliateOrder',
      custName: name,
      custPhone: phone,
      custAddr: addr,
      details: details,
      total: total,
      refCode: refCode
    };

    console.log('Sending order:', postData);

    // Dùng fetch API gửi bất đồng bộ lên Google Apps Script
    fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(postData)
    })
    .then(res => res.json())
    .then(res => {
      console.log('Response from GAS:', res);
      if (res.success) {
        showSuccessView(res.data, name, phone, details);
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Xác Nhận Đặt Hàng Giao Ngay';
      }
    })
    .catch(err => {
      console.error('GAS Post Error:', err);
      // fallback sinh mã đơn hàng giả định
      const mockOrderId = 'NCTTX-AFF-' + Math.floor(10000 + Math.random() * 90000);
      const fallbackData = {
        orderId: mockOrderId,
        total: total,
        refCode: refCode,
        commPct: refCode ? 5 : 0
      };
      showSuccessView(fallbackData, name, phone, details);
    });
  };

  // Hiển thị màn hình đặt hàng thành công + Sinh mã VietQR
  function showSuccessView(orderData, custName, custPhone, details) {
    document.getElementById('ncttxFormView').style.display = 'none';
    const successView = document.getElementById('ncttxSuccessView');
    successView.style.display = 'block';
    
    document.getElementById('ncttxSuccessDesc').innerHTML = `
      Chúng mình đã ghi nhận đơn hàng mã <strong>${orderData.orderId}</strong>.<br>
      Tổng số tiền: <strong>${orderData.total.toLocaleString('vi-VN')} VNĐ</strong>.
    `;
    
    const addInfo = encodeURIComponent(`${custName} CK ${orderData.orderId}`);
    const qrUrl = `https://img.vietqr.io/image/${CONFIG.BANK.ID}-${CONFIG.BANK.ACC_NO}-${CONFIG.BANK.TEMPLATE}.png?amount=${orderData.total}&addInfo=${addInfo}&accountName=${encodeURIComponent(CONFIG.BANK.NAME)}`;
    
    const qrImg = document.getElementById('ncttxQrImg');
    qrImg.src = qrUrl;
    
    const detailsStr = details.map(p => `- ${p.name} (x${p.qty})`).join('%0A');
    const zaloMsg = `Chào Nhà của Thời Thanh Xuân, mình vừa đặt đơn hàng trực tiếp qua web:
- Mã đơn: ${orderData.orderId}
- Khách hàng: ${custName}
- Số điện thoại: ${custPhone}
- Sản phẩm: 
${detailsStr}
- Tổng tiền: ${orderData.total.toLocaleString('vi-VN')} VNĐ
- Hình thức: Đã quét VietQR chuyển khoản.
Nhà đóng gói sớm giúp mình nhé!`;

    const zaloBtn = document.getElementById('ncttxZaloConfirmBtn');
    zaloBtn.href = `https://zalo.me/nhacuathoithanhxuan?text=${zaloMsg}`;
  }

  // ────────────────────────────────────────────────────────
  // 4. KHỞI CHẠY & GẮN EVENT CHO CÁC NÚT MUA HÀNG TRÊN TRANG
  // ────────────────────────────────────────────────────────
  function initAffiliateSystem() {
    parseAndSaveRef();
    
    // Nếu trang đánh dấu không sử dụng checkout modal (ví dụ: trang đăng ký đối tác affiliate.html)
    if (window.NCTTX_NO_CHECKOUT) {
      console.log('✓ NCTTX Affiliate: Đang ở chế độ chỉ tracking ref, không khởi tạo checkout modal.');
      return;
    }
    
    injectStyles();
    
    document.addEventListener('DOMContentLoaded', function() {
      const buySelectors = [
        '.ncttx-buy-btn',
        'a[href*="zalo.me/nhacuathoithanhxuan"]',
        'a[href*="zalo.me/090"]',
        'a[href*="kiotviet.nhacuathoithanhxuan"]',
        '.btn-zalo',
        '.btn-gold',
        '.nav-btn',
        'a[href*="#buy"]'
      ];
      
      const buttons = document.querySelectorAll(buySelectors.join(','));
      console.log(`✓ NCTTX Affiliate: Đã tìm thấy ${buttons.length} nút mua hàng để tích hợp.`);
      
      buttons.forEach(btn => {
        // Skip nav back button and custom links
        if (btn.classList.contains('back-btn') || btn.getAttribute('href') === 'tinh-dau.html') return;
        
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          showModal();
        });
      });
    });
  }

  // Tự động khởi chạy
  initAffiliateSystem();

})();
