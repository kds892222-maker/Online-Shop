const CUSTOMER_PART_TYPES = {
    1: "CPU",
    2: "GPU",
    3: "메인보드",
    4: "RAM",
    5: "SSD",
    6: "HDD",
    7: "파워",
    8: "팬",
    9: "케이스",
    10: "쿨러",
    11: "기타"
};

let customerParts = [];

function customerMoney(value) {
    const number = Number(value || 0);

    if (!Number.isFinite(number) || number <= 0) {
        return "가격문의";
    }

    return number.toLocaleString("ko-KR") + "원";
}

function customerTypeName(type) {
    return CUSTOMER_PART_TYPES[Number(type)] || "기타";
}

function customerImage(part) {
    const image = String(part["이미지"] || "").trim();

    if (image) {
        return `
            <img
                class="product-image"
                src="${escapeCustomerHtml(image)}"
                alt="${escapeCustomerHtml(part["이름"] || "제품 이미지")}"
                loading="lazy"
            >
        `;
    }

    return `
        <div class="product-image-placeholder">
            <span>${customerTypeName(part["종류"])}</span>
            <small>심심PC</small>
        </div>
    `;
}

function renderCustomerParts() {
    const list = document.getElementById("customer-list");
    const empty = document.getElementById("customer-empty");
    const count = document.getElementById("customer-stock-count");
    const keyword = document
        .getElementById("customer-search")
        .value
        .trim()
        .toLowerCase();
    const type = document.getElementById("customer-type-filter").value;

    const filtered = customerParts.filter(part => {
        if (type && Number(part["종류"]) !== Number(type)) {
            return false;
        }

        if (keyword) {
            const text = [
                part["이름"],
                customerTypeName(part["종류"])
            ]
                .join(" ")
                .toLowerCase();

            if (!text.includes(keyword)) {
                return false;
            }
        }

        return true;
    });

    count.textContent = `${filtered.length}개`;
    list.innerHTML = "";

    if (filtered.length === 0) {
        empty.classList.remove("hidden");
        return;
    }

    empty.classList.add("hidden");

    for (const part of filtered) {
        const card = document.createElement("article");
        card.className = "product-card";
        card.dataset.partId = part.id;
        card.tabIndex = 0;

        card.innerHTML = `
            <div class="product-image-area">
                ${customerImage(part)}

                <span class="product-badge">
                    ${customerTypeName(part["종류"])}
                </span>
            </div>

            <div class="product-card-body">
                <div class="product-price">
                    ${customerMoney(part["판매가"])}
                </div>

                <h2>${escapeCustomerHtml(part["이름"] || "-")}</h2>

                <div class="product-status">
                    정상 · 판매중
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            openCustomerDetail(Number(part.id));
        });

        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCustomerDetail(Number(part.id));
            }
        });

        list.appendChild(card);
    }
}

function openCustomerDetail(partId) {
    const part = customerParts.find(
        item => Number(item.id) === Number(partId)
    );

    if (!part) {
        return;
    }

    document.getElementById("detail-type").textContent =
        customerTypeName(part["종류"]);
    document.getElementById("detail-name").textContent =
        part["이름"] || "-";
    document.getElementById("detail-price").textContent =
        customerMoney(part["판매가"]);
    document.getElementById("detail-status").textContent =
        part["상태"] || "정상";
    document.getElementById("detail-id").textContent =
        `#${part.id}`;

    const imageArea = document.getElementById("detail-image-area");
    imageArea.innerHTML = customerImage(part);

    const modal = document.getElementById("customer-detail-modal");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeCustomerDetail() {
    const modal = document.getElementById("customer-detail-modal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function escapeCustomerHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadCustomerParts() {
    try {
        const response = await fetch("/api/customer/parts");

        if (!response.ok) {
            throw new Error("판매 재고를 불러오지 못했습니다.");
        }

        customerParts = await response.json();
        renderCustomerParts();
    }
    catch (error) {
        console.error(error);

        document.getElementById("customer-stock-count").textContent = "오류";
        document.getElementById("customer-empty").textContent =
            "판매 재고를 불러오지 못했습니다.";
        document.getElementById("customer-empty").classList.remove("hidden");
    }
}

document
    .getElementById("customer-search")
    .addEventListener("input", renderCustomerParts);

document
    .getElementById("customer-type-filter")
    .addEventListener("change", renderCustomerParts);

document
    .getElementById("detail-close-button")
    .addEventListener("click", closeCustomerDetail);

document
    .querySelectorAll("[data-close-detail]")
    .forEach(element => {
        element.addEventListener("click", closeCustomerDetail);
    });

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeCustomerDetail();
    }
});

loadCustomerParts();
