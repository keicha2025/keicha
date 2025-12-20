// card.js
// 基礎設定
const BASE_IMG_URL = "assets/images/"; 

/**
 * 產生單一商品卡的 HTML 字串
 * @param {Object} product - 商品資料物件
 * @returns {string} - HTML 字串
 */
function createProductCard(product) {
    // 1. 資料防呆處理
    const productId = product.key || Math.random().toString(36).substr(2, 9);
    const name = product.name || '未命名商品';
    const price = Number(product.price) || 0;
    const priceMulti = Number(product.price_multi) || 0;
    const status = product.status || '';
    const note = product.note || '';
    const tag = product.tag || '';
    const spec = product.spec || '';
    const imgPath = String(product.img || '');
    const stock = product.stock !== "" && product.stock !== undefined ? Number(product.stock) : 999;
    const maxLimit = product.max_limit || 99;

    // 2. 狀態判斷
    const isSoldOut = stock <= 0 || status.includes('完售');
    const hasMultiPrice = (priceMulti > 0 && priceMulti < price);
    const hasImage = imgPath !== '';

    // 3. 圖片邏輯
    let imgHTML = '';
    if (hasImage) {
        const src = imgPath.startsWith('http') ? imgPath : BASE_IMG_URL + imgPath;
        imgHTML = `
        <div class="card-img-group md:order-first md:relative md:w-full md:overflow-hidden">
            <img src="${src}" class="w-full h-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" alt="${name}">
        </div>`;
    }

    // 4. Badge 邏輯
    let badgeHTML = '';
    if (tag) {
        badgeHTML = `<span class="absolute top-3 right-3 bg-[#6ea44c] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full z-10 shadow-sm">${tag}</span>`;
    } else if (isSoldOut) {
        badgeHTML = `<span class="absolute top-3 right-3 bg-gray-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full z-10 shadow-sm">缺貨</span>`;
    }

    // 5. 價格顯示邏輯
    let priceHTML = '';
    if (hasMultiPrice) {
        priceHTML = `
            <div class="flex flex-col items-end w-full">
                <span class="text-xs text-gray-400">單件 $${price}</span>
                <span class="text-[#6ea44c] font-bold text-lg font-mono">2件起 $${priceMulti}</span>
            </div>`;
    } else {
        priceHTML = `
            <div class="w-full text-right">
                <span class="text-[#6ea44c] font-bold text-lg font-mono">NT$ ${price}</span>
            </div>`;
    }

    // 6. 按鈕邏輯
    const btnClass = isSoldOut ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#6ea44c] text-white transition active:scale-95 hover:bg-[#5d8d41] shadow-md shadow-green-900/10';
    // 注意：這裡假設主程式有一個 addToCart 函數
    const clickEvent = isSoldOut ? '' : `onclick="addToCart('${productId}', '${name}', ${price}, ${priceMulti}, ${stock}, ${maxLimit})"`;
    const btnText = isSoldOut ? '完售' : '加入購物車';
    const qtyDisable = isSoldOut ? 'disabled opacity-50' : '';

    // 7. 手機版佈局控制 CSS Class
    const topRowClass = `card-top-row md:contents ${hasImage ? 'items-center' : ''}`;

    // 8. 回傳最終 HTML
    return `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex flex-col mobile-product-card transition hover:shadow-lg group relative">
        ${badgeHTML}
        
        <div class="${topRowClass}">
            ${imgHTML}
            
            <div class="card-info-group p-5 flex-1 flex flex-col gap-3">
                <h4 class="font-bold text-gray-800 text-xl leading-tight line-clamp-1 flex items-baseline">
                    ${name}
                    ${spec ? `<span class="ml-2 text-gray-400 text-xs font-normal whitespace-nowrap">${spec}</span>` : ''}
                </h4>
                
                ${ note ? `<p class="text-gray-400 text-[11px] leading-relaxed line-clamp-2 min-h-[1.5em]">${note}</p>` : '' }

                <div class="mt-auto">
                    ${priceHTML}
                </div>
            </div>
        </div>

        <div class="card-bottom-row md:p-5 md:border-t md:flex md:gap-2">
            <div class="qty-control">
                <button class="qty-btn" onclick="adjQty('${productId}', -1)" ${qtyDisable}>-</button>
                <span id="iq-${productId}" class="text-xs font-bold px-2 min-w-[20px] text-center">1</span>
                <button class="qty-btn" onclick="adjQty('${productId}', 1)" ${qtyDisable}>+</button>
            </div>
            <button class="add-btn flex-1 py-3 rounded-xl text-xs font-bold ${btnClass}" ${clickEvent}>${btnText}</button>
        </div>
    </div>`;
}
