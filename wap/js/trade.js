const TRANSACTION_TYPES = {
    1: "매입",
    2: "판매"
};


let currentTransactionType = 1;


const PART_TYPE_OPTIONS = {
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


const PART_STATUS_OPTIONS = {
    1: "정상",
    2: "고장",
    3: "미확인"
};


function formatKoreanMoney(value) {

    const number = Number(value);


    if (
        !Number.isFinite(number)
        || number <= 0
    ) {

        return "0원";

    }


    const eok = Math.floor(
        number / 100000000
    );


    const man = Math.floor(
        (number % 100000000) / 10000
    );


    const won =
        number % 10000;


    const result = [];


    if (eok > 0) {

        result.push(
            eok + "억"
        );

    }


    if (man > 0) {

        result.push(
            man + "만"
        );

    }


    if (won > 0) {

        result.push(
            won + "원"
        );

    }

    else {

        result.push(
            "원"
        );

    }


    return result.join(" ");

}


function setTransactionType(type) {

    currentTransactionType = type;


    const buyButton =
        document.getElementById(
            "buy-button"
        );


    const sellButton =
        document.getElementById(
            "sell-button"
        );


    const buyArea =
        document.getElementById(
            "buy-parts-area"
        );


    const sellArea =
        document.getElementById(
            "sell-parts-area"
        );


    if (type === 1) {

        buyButton.classList.add(
            "active"
        );

        sellButton.classList.remove(
            "active"
        );


        buyArea.classList.remove(
            "hidden"
        );

        sellArea.classList.add(
            "hidden"
        );

    }

    else {

        sellButton.classList.add(
            "active"
        );

        buyButton.classList.remove(
            "active"
        );


        sellArea.classList.remove(
            "hidden"
        );

        buyArea.classList.add(
            "hidden"
        );


        renderSellParts();

    }

}


function createOptions(data) {

    return Object.entries(data)
        .map(
            ([value, name]) => {

                return `
                    <option value="${value}">
                        ${name}
                    </option>
                `;

            }
        )
        .join("");

}


function addNewPartRow() {

    const list =
        document.getElementById(
            "new-parts-list"
        );


    if (!list) {
        return;
    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "part-input-row";


    item.style.gridTemplateColumns =
        "150px 150px 1fr 90px 80px";


    item.innerHTML = `

        <select class="part-type">
            ${createOptions(
                PART_TYPE_OPTIONS
            )}
        </select>


        <select class="part-status">
            ${createOptions(
                PART_STATUS_OPTIONS
            )}
        </select>


        <input
            class="part-name"
            type="text"
            placeholder="부품 이름"
        >


        <input
            class="part-quantity"
            type="number"
            min="1"
            step="1"
            value="1"
            placeholder="수량"
        >


        <button
            class="remove-part-button"
            type="button"
        >
            삭제
        </button>

    `;


    item
        .querySelector(
            ".remove-part-button"
        )
        .addEventListener(
            "click",
            () => {

                item.remove();

            }
        );


    list.appendChild(
        item
    );

}


function getNewParts() {

    const rows =
        document.querySelectorAll(
            "#new-parts-list .part-input-row"
        );


    const parts = [];


    for (const row of rows) {

        const type =
            Number(
                row.querySelector(
                    ".part-type"
                ).value
            );


        const status =
            Number(
                row.querySelector(
                    ".part-status"
                ).value
            );


        const name =
            row.querySelector(
                ".part-name"
            )
                .value
                .trim();


        const quantityInput =
            row.querySelector(
                ".part-quantity"
            );


        const quantity =
            Math.max(
                1,
                Math.floor(
                    Number(
                        quantityInput
                            ? quantityInput.value
                            : 1
                    ) || 1
                )
            );


        if (!name) {
            continue;
        }


        for (
            let index = 0;
            index < quantity;
            index++
        ) {

            parts.push({
                "종류": type,
                "고장여부": status,
                "이름": name
            });

        }

    }


    return parts;

}


function renderSellParts() {

    const list =
        document.getElementById(
            "sell-parts-list"
        );


    if (!list) {
        return;
    }


    list.innerHTML = "";


    if (
        typeof cachedParts
        === "undefined"
    ) {

        list.innerHTML =
            "<p>부품 목록을 불러오는 중입니다.</p>";

        return;

    }


    const availableParts =
        cachedParts.filter(
            part => {

                return !part["판매그룹"];

            }
        );


    if (
        availableParts.length === 0
    ) {

        list.innerHTML =
            "<p>판매 가능한 부품이 없습니다.</p>";

        return;

    }


    for (
        const part
        of availableParts
    ) {

        const item =
            document.createElement(
                "label"
            );


        item.className =
            "sell-part-item";


        const typeName =
            typeof getPartTypeName === "function"
                ? getPartTypeName(
                    part["종류"]
                )
                : part["종류"];


        const statusName =
            typeof getPartStatusName === "function"
                ? getPartStatusName(
                    part["고장여부"]
                )
                : part["고장여부"];


        item.innerHTML = `

            <input
                type="checkbox"
                value="${part.id}"
                class="sell-part-checkbox"
            >

            <span class="sell-part-id">
                #${part.id}
            </span>

            <span class="sell-part-name">
                ${part["이름"] || "-"}
            </span>

            <span>
                ${typeName}
            </span>

            <span>
                ${statusName}
            </span>

        `;


        list.appendChild(
            item
        );

    }

}


function getSelectedSellParts() {

    const checked =
        document.querySelectorAll(
            ".sell-part-checkbox:checked"
        );


    return Array
        .from(checked)
        .map(
            checkbox =>
                Number(
                    checkbox.value
                )
        );

}


async function refreshSummary() {

    try {

        const response =
            await fetch(
                "/api/transactions"
            );


        if (!response.ok) {
            return;
        }


        const transactions =
            await response.json();


        if (
            typeof updateSummary
            === "function"
        ) {

            updateSummary(
                transactions
            );

        }

    }

    catch (error) {

        console.error(
            error
        );

    }

}


async function addTransaction() {

    const message =
        document.getElementById(
            "transaction-message"
        );


    const priceInput =
        document.getElementById(
            "transaction-price"
        );


    const memoInput =
        document.getElementById(
            "transaction-memo"
        );


    const price =
        Number(
            priceInput.value
        );


    const memo =
        memoInput.value.trim();


    if (
        !Number.isFinite(price)
        || price <= 0
    ) {

        message.textContent =
            "금액을 올바르게 입력해주세요.";

        return;

    }


    let relatedParts;


    if (
        currentTransactionType === 1
    ) {

        relatedParts =
            getNewParts();


        if (
            relatedParts.length === 0
        ) {

            message.textContent =
                "관련부품을 한 개 이상 등록해주세요.";

            return;

        }

    }

    else {

        relatedParts =
            getSelectedSellParts();


        if (
            relatedParts.length === 0
        ) {

            message.textContent =
                "판매할 부품을 선택해주세요.";

            return;

        }

    }


    const data = {

        "구분":
            currentTransactionType,

        "금액":
            price,

        "메모":
            memo,

        "관련부품":
            relatedParts

    };


    try {

        const response =
            await fetch(
                "/api/transactions",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            data
                        )

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.textContent =
                result.detail
                || "거래 등록 실패";

            return;

        }


        message.textContent =
            "거래 등록 완료: "
            + (
                result["거래그룹"]
                || "-"
            );


        priceInput.value = "";

        memoInput.value = "";


        const priceText =
            document.getElementById(
                "price-text"
            );


        if (priceText) {

            priceText.textContent =
                "0원";

        }


        const newPartsList =
            document.getElementById(
                "new-parts-list"
            );


        if (newPartsList) {

            newPartsList.innerHTML =
                "";

        }


        if (
            typeof loadParts
            === "function"
        ) {

            await loadParts();

        }


        await refreshSummary();


        if (
            currentTransactionType
            === 1
        ) {

            addNewPartRow();

        }

        else {

            renderSellParts();

        }

    }

    catch (error) {

        console.error(
            error
        );


        message.textContent =
            "서버 연결 실패";

    }

}


const priceInput =
    document.getElementById(
        "transaction-price"
    );


const priceText =
    document.getElementById(
        "price-text"
    );


if (
    priceInput
    && priceText
) {

    priceInput.addEventListener(
        "input",
        () => {

            priceText.textContent =
                formatKoreanMoney(
                    priceInput.value
                );

        }
    );

}


const buyButton =
    document.getElementById(
        "buy-button"
    );


if (buyButton) {

    buyButton.addEventListener(
        "click",
        () => {

            setTransactionType(
                1
            );

        }
    );

}


const sellButton =
    document.getElementById(
        "sell-button"
    );


if (sellButton) {

    sellButton.addEventListener(
        "click",
        () => {

            setTransactionType(
                2
            );

        }
    );

}


const addPartButton =
    document.getElementById(
        "add-part-button"
    );


if (addPartButton) {

    addPartButton.addEventListener(
        "click",
        addNewPartRow
    );

}


const transactionAddButton =
    document.getElementById(
        "transaction-add-button"
    );


if (transactionAddButton) {

    transactionAddButton.addEventListener(
        "click",
        addTransaction
    );

}


addNewPartRow();

refreshSummary();