const TYPES = {1:"CPU",2:"GPU",3:"메인보드",4:"RAM",5:"SSD",6:"HDD",7:"파워",8:"팬",9:"케이스",10:"쿨러",11:"기타"};
const $ = id => document.getElementById(id);
const modal = $("customer-detail-modal");
let products = [], previousFocus;
const money = value => Number(value) > 0 ? Number(value).toLocaleString("ko-KR") + "원" : "가격문의";
const typeName = value => TYPES[value] || "기타";
function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function productImage(part) {
    const placeholder = element("div", "product-image-placeholder");
    placeholder.append(element("span", "", typeName(part["종류"])), element("small", "", "심심PC"));
    const path = part["이미지"];
    if (typeof path !== "string" || !/^uploads\/[a-f0-9]{64}\.(jpg|jpeg|png|webp)$/.test(path)) return placeholder;
    const img = element("img", "product-image");
    img.alt = part["이름"];
    img.loading = "lazy";
    img.src = path;
    img.addEventListener("error", () => img.replaceWith(placeholder), {once:true});
    return img;
}
function render() {
    const keyword = $("customer-search").value.trim().toLowerCase();
    const kind = $("customer-type-filter").value;
    const filtered = products.filter(p =>
        (!kind || String(p["종류"]) === kind) &&
        [p["이름"], typeName(p["종류"]), p["재고번호"]].join(" ").toLowerCase().includes(keyword));
    $("customer-stock-count").textContent = filtered.length + "개";
    $("customer-list").replaceChildren();
    $("customer-empty").textContent = products.length ? "검색 조건에 맞는 제품이 없습니다." : "현재 판매 가능한 제품이 없습니다.";
    $("customer-empty").classList.toggle("hidden", filtered.length > 0);
    for (const part of filtered) {
        const card = element("button", "product-card");
        card.type = "button";
        const picture = element("div", "product-image-area");
        picture.append(productImage(part), element("span", "product-badge", typeName(part["종류"])));
        const body = element("div", "product-card-body");
        body.append(element("div", "product-price", money(part["목표판매가"])),
            element("h2", "", part["이름"]),
            element("div", "product-status", "재고번호 #" + part["재고번호"]));
        card.append(picture, body);
        card.addEventListener("click", () => openDetail(part));
        $("customer-list").append(card);
    }
}
function openDetail(part) {
    previousFocus = document.activeElement;
    $("detail-type").textContent = typeName(part["종류"]);
    $("detail-name").textContent = part["이름"];
    $("detail-price").textContent = money(part["목표판매가"]);
    $("detail-id").textContent = "#" + part["재고번호"];
    $("detail-inquiry-example").textContent = "재고번호 " + part["재고번호"] + " 보고 왔는데요, 구매할 수 있을까요?";
    $("copy-inquiry-status").textContent = "";
    $("detail-image-area").replaceChildren(productImage(part));
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.querySelector("main").inert = true;
    document.querySelector("header").inert = true;
    document.body.style.overflow = "hidden";
    $("detail-close-button").focus();
}
function closeDetail() {
    if (modal.classList.contains("hidden")) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.querySelector("main").inert = false;
    document.querySelector("header").inert = false;
    document.body.style.overflow = "";
    previousFocus?.focus();
}
async function copyInquiry() {
    const text = $("detail-inquiry-example").textContent;
    const status = $("copy-inquiry-status");
    status.textContent = "";
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        const field = document.createElement("textarea");
        field.value = text;
        field.readOnly = true;
        field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        modal.append(field);
        let copied = false;
        try {
            field.select();
            field.setSelectionRange(0, field.value.length);
            copied = document.execCommand("copy");
        } catch (fallbackError) {
            copied = false;
        } finally {
            field.remove();
            $("copy-inquiry-button").focus();
        }
        if (!copied) {
            status.textContent = "복사하지 못했어요. 위 문구를 길게 누르거나 선택해서 복사해 주세요.";
            return;
        }
    }
    if ($("detail-inquiry-example").textContent === text) {
        status.textContent = "복사했어요! 당근 채팅에 붙여넣어 주세요.";
    }
}
async function load() {
    try {
        const response = await fetch("./products.json", {cache:"no-store"});
        if (!response.ok) throw new Error("Inventory unavailable");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid inventory");
        products = data.filter(part => typeof part["이미지"] === "string" &&
            /^uploads\/[a-f0-9]{64}\.(jpg|jpeg|png|webp)$/.test(part["이미지"]));
        render();
    } catch (error) {
        $("customer-stock-count").textContent = "오류";
        $("customer-empty").textContent = "재고를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
        $("customer-empty").classList.remove("hidden");
        $("customer-search").disabled = true;
        $("customer-type-filter").disabled = true;
    }
}
$("customer-search").addEventListener("input", render);
$("customer-type-filter").addEventListener("change", render);
$("detail-close-button").addEventListener("click", closeDetail);
$("copy-inquiry-button").addEventListener("click", copyInquiry);
document.querySelector("[data-close-detail]").addEventListener("click", closeDetail);
document.addEventListener("keydown", event => {
    if (modal.classList.contains("hidden")) return;
    if (event.key === "Escape") closeDetail();
    if (event.key === "Tab") {
        const first = $("detail-close-button"), last = modal.querySelector(".daangn-button");
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
});
load();
