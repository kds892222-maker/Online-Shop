const PART_TYPES = {
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


const PART_STATUS = {
    1: "정상",
    2: "고장",
    3: "미확인"
};


const TRANSACTION_TYPE_NAMES = {
    1: "매입",
    2: "판매"
};


let cachedParts = [];

let cachedTransactions = [];

let editingPartId = null;

let editingTransactionId = null;


/* =========================================================
   공통
========================================================= */

function getPartTypeName(type) {

    return (
        PART_TYPES[
            Number(type)
        ]
        || "-"
    );

}


function getPartStatusName(status) {

    return (
        PART_STATUS[
            Number(status)
        ]
        || "-"
    );

}


function inventoryMoney(value) {

    return (
        Number(value || 0)
            .toLocaleString("ko-KR")
        + "원"
    );

}


function formatInventoryKoreanMoney(value) {

    const number = Number(value);


    if (
        !Number.isFinite(number)
        || number <= 0
    ) {

        return "0원";

    }


    const eok =
        Math.floor(
            number / 100000000
        );


    const man =
        Math.floor(
            (
                number % 100000000
            ) / 10000
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


function createPartTypeOptions(
    selected = 1
) {

    return Object.entries(
        PART_TYPES
    )
        .map(
            ([value, name]) => {

                const selectedText =
                    Number(value)
                    === Number(selected)
                        ? "selected"
                        : "";


                return `
                    <option
                        value="${value}"
                        ${selectedText}
                    >
                        ${name}
                    </option>
                `;

            }
        )
        .join("");

}


function createPartStatusOptions(
    selected = 3
) {

    return Object.entries(
        PART_STATUS
    )
        .map(
            ([value, name]) => {

                const selectedText =
                    Number(value)
                    === Number(selected)
                        ? "selected"
                        : "";


                return `
                    <option
                        value="${value}"
                        ${selectedText}
                    >
                        ${name}
                    </option>
                `;

            }
        )
        .join("");

}


/* =========================================================
   날짜
========================================================= */

function parseDateOnly(dateText) {

    if (!dateText) {
        return null;
    }


    const values =
        String(dateText)
            .split("-");


    if (
        values.length !== 3
    ) {

        return null;

    }


    return new Date(
        Number(values[0]),
        Number(values[1]) - 1,
        Number(values[2])
    );

}


function getTodayDateOnly() {

    const now =
        new Date();


    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

}


function getDaysAgo(dateText) {

    const transactionDate =
        parseDateOnly(
            dateText
        );


    if (!transactionDate) {

        return null;

    }


    const today =
        getTodayDateOnly();


    return Math.floor(
        (
            today.getTime()
            - transactionDate.getTime()
        )
        /
        86400000
    );

}


/* =========================================================
   데이터 로드
========================================================= */

async function loadParts() {

    try {

        const response =
            await fetch(
                "/api/parts"
            );


        if (!response.ok) {

            throw new Error(
                "부품 목록 로드 실패"
            );

        }


        cachedParts =
            await response.json();


        updatePartCount();

        updateBuyGroupFilter();

        renderInventory();

    }

    catch (error) {

        console.error(error);

    }

}


async function loadInventoryTransactions() {

    try {

        const response =
            await fetch(
                "/api/transactions"
            );


        if (!response.ok) {

            throw new Error(
                "거래내역 로드 실패"
            );

        }


        cachedTransactions =
            await response.json();


        if (
            typeof updateSummary
            === "function"
        ) {

            updateSummary(
                cachedTransactions
            );

        }


        renderInventory();

    }

    catch (error) {

        console.error(error);

    }

}


function updatePartCount() {

    const element =
        document.getElementById(
            "total-parts"
        );


    if (element) {

        element.textContent =
            cachedParts.length
            + "개";

    }

}


/* =========================================================
   매입그룹 필터
========================================================= */

function updateBuyGroupFilter() {

    const select =
        document.getElementById(
            "filter-buy-group"
        );


    if (!select) {
        return;
    }


    const currentValue =
        select.value;


    const groups =
        [
            ...new Set(
                cachedParts
                    .map(
                        part =>
                            part["매입그룹"]
                    )
                    .filter(Boolean)
            )
        ];


    groups.sort(
        (a, b) =>
            String(a)
                .localeCompare(
                    String(b),
                    undefined,
                    {
                        numeric: true
                    }
                )
    );


    select.innerHTML = `

        <option value="">
            매입그룹 전체
        </option>

    `;


    for (const group of groups) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            group;


        option.textContent =
            group;


        select.appendChild(
            option
        );

    }


    if (
        groups.includes(
            currentValue
        )
    ) {

        select.value =
            currentValue;

    }

}


/* =========================================================
   부품 / 거래내역
========================================================= */

function changeInventoryMode() {

    const mode =
        document.getElementById(
            "inventory-mode"
        ).value;


    const partFilters =
        document.getElementById(
            "parts-filter-area"
        );


    const transactionFilters =
        document.getElementById(
            "transactions-filter-area"
        );


    const partTable =
        document.getElementById(
            "parts-result-table"
        );


    const transactionTable =
        document.getElementById(
            "transactions-result-table"
        );


    if (mode === "parts") {

        partFilters.classList.remove(
            "hidden"
        );


        transactionFilters.classList.add(
            "hidden"
        );


        partTable.classList.remove(
            "hidden"
        );


        transactionTable.classList.add(
            "hidden"
        );

    }

    else {

        partFilters.classList.add(
            "hidden"
        );


        transactionFilters.classList.remove(
            "hidden"
        );


        partTable.classList.add(
            "hidden"
        );


        transactionTable.classList.remove(
            "hidden"
        );

    }


    renderInventory();

}


function renderInventory() {

    const mode =
        document.getElementById(
            "inventory-mode"
        );


    if (!mode) {
        return;
    }


    if (
        mode.value === "parts"
    ) {

        renderParts();

    }

    else {

        renderTransactions();

    }

}


/* =========================================================
   부품 목록
========================================================= */

function renderParts() {

    const table =
        document.getElementById(
            "parts-table"
        );


    if (!table) {
        return;
    }


    const keyword =
        document
            .getElementById(
                "inventory-search"
            )
            .value
            .trim()
            .toLowerCase();


    const buyGroup =
        document.getElementById(
            "filter-buy-group"
        ).value;


    const sellStatus =
        document.getElementById(
            "filter-sell-group"
        ).value;


    const type =
        document.getElementById(
            "filter-part-type"
        ).value;


    const status =
        document.getElementById(
            "filter-part-status"
        ).value;


    const results =
        cachedParts.filter(
            part => {

                if (
                    buyGroup
                    &&
                    part["매입그룹"]
                    !== buyGroup
                ) {

                    return false;

                }


                if (
                    sellStatus === "unsold"
                    &&
                    part["판매그룹"]
                ) {

                    return false;

                }


                if (
                    sellStatus === "sold"
                    &&
                    !part["판매그룹"]
                ) {

                    return false;

                }


                if (
                    type
                    &&
                    Number(
                        part["종류"]
                    )
                    !== Number(type)
                ) {

                    return false;

                }


                if (
                    status
                    &&
                    Number(
                        part["고장여부"]
                    )
                    !== Number(status)
                ) {

                    return false;

                }


                if (keyword) {

                    const text = [
                        part.id,
                        part["이름"],
                        part["매입그룹"],
                        part["판매그룹"],
                        getPartTypeName(
                            part["종류"]
                        ),
                        getPartStatusName(
                            part["고장여부"]
                        )
                    ]
                        .join(" ")
                        .toLowerCase();


                    if (
                        !text.includes(
                            keyword
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    table.innerHTML = "";


    for (const part of results) {

        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `

            <td>
                ${part.id}
            </td>

            <td>
                ${part["이름"] || "-"}
            </td>

            <td>
                ${
                    getPartTypeName(
                        part["종류"]
                    )
                }
            </td>

            <td>
                ${
                    getPartStatusName(
                        part["고장여부"]
                    )
                }
            </td>

            <td>
                ${part["매입그룹"] || "-"}
            </td>

            <td>
                ${part["판매그룹"] || "-"}
            </td>

            <td>

                <button
                    type="button"
                    class="small-button"
                    data-edit-part="${part.id}"
                >
                    수정
                </button>

            </td>

        `;


        table.appendChild(
            row
        );

    }


    table
        .querySelectorAll(
            "[data-edit-part]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openPartEdit(
                            Number(
                                button.dataset.editPart
                            )
                        );

                    }
                );

            }
        );


    updateResultCount(
        results.length
    );

}


/* =========================================================
   거래내역
========================================================= */

function renderTransactions() {

    const table =
        document.getElementById(
            "inventory-transactions-table"
        );


    if (!table) {
        return;
    }


    const keyword =
        document
            .getElementById(
                "inventory-search"
            )
            .value
            .trim()
            .toLowerCase();


    const type =
        document.getElementById(
            "filter-transaction-type"
        ).value;


    const daysValue =
        document.getElementById(
            "filter-transaction-days"
        ).value;


    const results =
        cachedTransactions.filter(
            transaction => {

                if (
                    type
                    &&
                    Number(
                        transaction["구분"]
                    )
                    !== Number(type)
                ) {

                    return false;

                }


                if (
                    daysValue !== ""
                ) {

                    const daysAgo =
                        getDaysAgo(
                            transaction["날짜"]
                        );


                    if (
                        daysAgo === null
                    ) {

                        return false;

                    }


                    if (
                        daysAgo < 0
                        ||
                        daysAgo
                        > Number(daysValue)
                    ) {

                        return false;

                    }

                }


                if (keyword) {

                    const related =
                        Array.isArray(
                            transaction[
                                "관련부품"
                            ]
                        )
                            ? transaction[
                                "관련부품"
                            ].join(" ")
                            : "";


                    const text = [
                        transaction.id,
                        TRANSACTION_TYPE_NAMES[
                            Number(
                                transaction["구분"]
                            )
                        ],
                        transaction["거래그룹"],
                        transaction["금액"],
                        transaction["날짜"],
                        transaction["메모"],
                        related
                    ]
                        .join(" ")
                        .toLowerCase();


                    if (
                        !text.includes(
                            keyword
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    table.innerHTML =
        "";


    for (
        const transaction
        of results
    ) {

        const related =
            Array.isArray(
                transaction["관련부품"]
            )
                ? transaction[
                    "관련부품"
                ].join(", ")
                : "-";


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `

            <td>
                ${transaction.id}
            </td>

            <td>
                ${
                    TRANSACTION_TYPE_NAMES[
                        Number(
                            transaction["구분"]
                        )
                    ]
                    || "-"
                }
            </td>

            <td>
                ${transaction["거래그룹"] || "-"}
            </td>

            <td>
                ${
                    inventoryMoney(
                        transaction["금액"]
                    )
                }
            </td>

            <td>
                ${transaction["날짜"] || "-"}
            </td>

            <td>
                ${transaction["메모"] || "-"}
            </td>

            <td>
                ${related}
            </td>

            <td>

                <button
                    type="button"
                    class="small-button"
                    data-edit-transaction="${transaction.id}"
                >
                    수정
                </button>

            </td>

        `;


        table.appendChild(
            row
        );

    }


    table
        .querySelectorAll(
            "[data-edit-transaction]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openTransactionEdit(
                            Number(
                                button.dataset.editTransaction
                            )
                        );

                    }
                );

            }
        );


    updateResultCount(
        results.length
    );

}


/* =========================================================
   검색 결과 개수
========================================================= */

function updateResultCount(count) {

    const element =
        document.getElementById(
            "inventory-result-count"
        );


    if (element) {

        element.textContent =
            `검색 결과 ${count}개`;

    }

}


/* =========================================================
   부품 수정
========================================================= */

function openPartEdit(partId) {

    const part =
        cachedParts.find(
            item =>
                Number(item.id)
                === Number(partId)
        );


    if (!part) {

        alert(
            "부품을 찾을 수 없습니다."
        );

        return;

    }


    editingPartId =
        Number(part.id);


    document.getElementById(
        "edit-part-id-text"
    ).textContent =
        `ID ${part.id}`;


    document.getElementById(
        "edit-part-name"
    ).value =
        part["이름"] || "";


    document.getElementById(
        "edit-part-type"
    ).value =
        String(
            part["종류"]
        );


    document.getElementById(
        "edit-part-status"
    ).value =
        String(
            part["고장여부"]
        );


    document.getElementById(
        "edit-buy-group"
    ).textContent =
        part["매입그룹"]
        || "-";


    document.getElementById(
        "edit-sell-group"
    ).textContent =
        part["판매그룹"]
        || "-";


    document.getElementById(
        "edit-part-message"
    ).textContent = "";


    openPage(
        "part-edit",
        "inventory"
    );

}


async function savePart() {

    if (
        editingPartId === null
    ) {

        return;

    }


    const name =
        document
            .getElementById(
                "edit-part-name"
            )
            .value
            .trim();


    const type =
        Number(
            document.getElementById(
                "edit-part-type"
            ).value
        );


    const status =
        Number(
            document.getElementById(
                "edit-part-status"
            ).value
        );


    const message =
        document.getElementById(
            "edit-part-message"
        );


    if (!name) {

        message.textContent =
            "이름을 입력해주세요.";

        return;

    }


    try {

        const response =
            await fetch(
                `/api/parts/${editingPartId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            "이름": name,
                            "종류": type,
                            "고장여부": status
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.textContent =
                result.detail
                || "수정 실패";

            return;

        }


        editingPartId =
            null;


        await loadParts();


        openPage(
            "inventory"
        );

    }

    catch (error) {

        console.error(error);


        message.textContent =
            "서버 연결 실패";

    }

}


async function deletePart() {

    if (
        editingPartId === null
    ) {

        return;

    }


    const part =
        cachedParts.find(
            item =>
                Number(item.id)
                === Number(
                    editingPartId
                )
        );


    if (!part) {
        return;
    }


    const confirmed =
        confirm(
            `${part["이름"]} 부품을 삭제하시겠습니까?\n\n`
            +
            "연결된 거래의 관련부품에서도 제거됩니다.\n"
            +
            "이 작업은 되돌릴 수 없습니다."
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/parts/${editingPartId}`,
                {
                    method:
                        "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.detail
                || "삭제 실패"
            );

            return;

        }


        editingPartId =
            null;


        await loadParts();

        await loadInventoryTransactions();


        openPage(
            "inventory"
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "서버 연결 실패"
        );

    }

}


/* =========================================================
   거래 수정
========================================================= */

function openTransactionEdit(
    transactionId
) {

    const transaction =
        cachedTransactions.find(
            item =>
                Number(item.id)
                === Number(
                    transactionId
                )
        );


    if (!transaction) {

        alert(
            "거래를 찾을 수 없습니다."
        );

        return;

    }


    editingTransactionId =
        Number(
            transaction.id
        );


    document.getElementById(
        "edit-transaction-id-text"
    ).textContent =
        `ID ${transaction.id}`;


    document.getElementById(
        "edit-transaction-type"
    ).value =
        String(
            transaction["구분"]
        );


    const priceInput =
        document.getElementById(
            "edit-transaction-price"
        );


    priceInput.value =
        transaction["금액"];


    document.getElementById(
        "edit-transaction-price-text"
    ).textContent =
        formatInventoryKoreanMoney(
            transaction["금액"]
        );


    document.getElementById(
        "edit-transaction-memo"
    ).value =
        transaction["메모"]
        || "";


    document.getElementById(
        "edit-transaction-group"
    ).textContent =
        transaction["거래그룹"]
        || "-";


    document.getElementById(
        "edit-transaction-date"
    ).textContent =
        transaction["날짜"]
        || "-";


    document.getElementById(
        "edit-transaction-message"
    ).textContent =
        "";


    const list =
        document.getElementById(
            "edit-transaction-parts-list"
        );


    list.innerHTML = "";


    const relatedIds =
        Array.isArray(
            transaction["관련부품"]
        )
            ? transaction[
                "관련부품"
            ]
            : [];


    for (
        const partId
        of relatedIds
    ) {

        const part =
            cachedParts.find(
                item =>
                    Number(item.id)
                    === Number(partId)
            );


        if (!part) {
            continue;
        }


        addTransactionPartRow(
            part
        );

    }


    openPage(
        "transaction-edit",
        "inventory"
    );

}


/* 기존 / 신규 둘 다 같은 폼 */

function addTransactionPartRow(
    part = null
) {

    const list =
        document.getElementById(
            "edit-transaction-parts-list"
        );


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "part-input-row";


    if (part) {

        row.dataset.partId =
            part.id;

    }


    row.innerHTML = `

        <select
            class="edit-transaction-part-type"
        >
            ${
                createPartTypeOptions(
                    part
                        ? part["종류"]
                        : 1
                )
            }
        </select>


        <select
            class="edit-transaction-part-status"
        >
            ${
                createPartStatusOptions(
                    part
                        ? part["고장여부"]
                        : 3
                )
            }
        </select>


        <input
            class="edit-transaction-part-name"
            type="text"
            placeholder="부품 이름"
            value="${
                part
                    ? escapeHtmlAttribute(
                        part["이름"]
                    )
                    : ""
            }"
        >


        <button
            class="remove-part-button"
            type="button"
        >
            삭제
        </button>

    `;


    row
        .querySelector(
            ".remove-part-button"
        )
        .addEventListener(
            "click",
            () => {

                row.remove();

            }
        );


    list.appendChild(
        row
    );

}


function escapeHtmlAttribute(value) {

    return String(
        value || ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        );

}


function getTransactionEditParts() {

    const rows =
        document.querySelectorAll(
            "#edit-transaction-parts-list .part-input-row"
        );


    const result = [];


    for (
        const row
        of rows
    ) {

        const name =
            row
                .querySelector(
                    ".edit-transaction-part-name"
                )
                .value
                .trim();


        if (!name) {

            continue;

        }


        const data = {

            "종류":
                Number(
                    row.querySelector(
                        ".edit-transaction-part-type"
                    ).value
                ),

            "고장여부":
                Number(
                    row.querySelector(
                        ".edit-transaction-part-status"
                    ).value
                ),

            "이름":
                name

        };


        if (
            row.dataset.partId
        ) {

            data.id =
                Number(
                    row.dataset.partId
                );

        }


        result.push(
            data
        );

    }


    return result;

}


async function saveTransaction() {

    if (
        editingTransactionId
        === null
    ) {

        return;

    }


    const message =
        document.getElementById(
            "edit-transaction-message"
        );


    const type =
        Number(
            document.getElementById(
                "edit-transaction-type"
            ).value
        );


    const price =
        Number(
            document.getElementById(
                "edit-transaction-price"
            ).value
        );


    const memo =
        document
            .getElementById(
                "edit-transaction-memo"
            )
            .value
            .trim();


    const relatedParts =
        getTransactionEditParts();


    if (
        !Number.isFinite(price)
        ||
        price <= 0
    ) {

        message.textContent =
            "금액을 올바르게 입력해주세요.";

        return;

    }


    if (
        relatedParts.length === 0
    ) {

        message.textContent =
            "관련부품을 한 개 이상 입력해주세요.";

        return;

    }


    const data = {

        "구분":
            type,

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
                `/api/transactions/${editingTransactionId}`,
                {

                    method:
                        "PUT",

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
                || "거래 수정 실패";

            return;

        }


        editingTransactionId =
            null;


        await loadParts();

        await loadInventoryTransactions();


        document.getElementById(
            "inventory-mode"
        ).value =
            "transactions";


        changeInventoryMode();


        openPage(
            "inventory"
        );

    }

    catch (error) {

        console.error(error);


        message.textContent =
            "서버 연결 실패";

    }

}


/* =========================================================
   거래 삭제
========================================================= */

async function deleteTransaction() {

    if (
        editingTransactionId
        === null
    ) {

        return;

    }


    const transaction =
        cachedTransactions.find(
            item =>
                Number(item.id)
                === Number(
                    editingTransactionId
                )
        );


    if (!transaction) {
        return;
    }


    const confirmed =
        confirm(

            `${transaction["거래그룹"]} 거래를 삭제하시겠습니까?\n\n`
            +
            "이 작업은 되돌릴 수 없습니다."

        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/transactions/${editingTransactionId}`,
                {
                    method:
                        "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.detail
                || "거래 삭제 실패"
            );

            return;

        }


        editingTransactionId =
            null;


        await loadParts();

        await loadInventoryTransactions();


        document.getElementById(
            "inventory-mode"
        ).value =
            "transactions";


        changeInventoryMode();


        openPage(
            "inventory"
        );

    }

    catch (error) {

        console.error(error);


        alert(
            "서버 연결 실패"
        );

    }

}


/* =========================================================
   필터 초기화
========================================================= */

function resetPartFilters() {

    document.getElementById(
        "filter-buy-group"
    ).value = "";


    document.getElementById(
        "filter-sell-group"
    ).value = "";


    document.getElementById(
        "filter-part-type"
    ).value = "";


    document.getElementById(
        "filter-part-status"
    ).value = "";


    document.getElementById(
        "inventory-search"
    ).value = "";


    renderParts();

}


function resetTransactionFilters() {

    document.getElementById(
        "filter-transaction-type"
    ).value = "";


    document.getElementById(
        "filter-transaction-days"
    ).value = "";


    document.getElementById(
        "inventory-search"
    ).value = "";


    renderTransactions();

}


/* =========================================================
   이벤트
========================================================= */

document
    .getElementById(
        "inventory-mode"
    )
    ?.addEventListener(
        "change",
        changeInventoryMode
    );


document
    .getElementById(
        "inventory-search-button"
    )
    ?.addEventListener(
        "click",
        renderInventory
    );


document
    .getElementById(
        "inventory-search"
    )
    ?.addEventListener(
        "keydown",
        event => {

            if (
                event.key
                === "Enter"
            ) {

                renderInventory();

            }

        }
    );


[
    "filter-buy-group",
    "filter-sell-group",
    "filter-part-type",
    "filter-part-status"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderParts
            );

    }
);


[
    "filter-transaction-type",
    "filter-transaction-days"
]
.forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderTransactions
            );

    }
);


document
    .getElementById(
        "parts-filter-reset"
    )
    ?.addEventListener(
        "click",
        resetPartFilters
    );


document
    .getElementById(
        "transactions-filter-reset"
    )
    ?.addEventListener(
        "click",
        resetTransactionFilters
    );


document
    .getElementById(
        "save-part-button"
    )
    ?.addEventListener(
        "click",
        savePart
    );


document
    .getElementById(
        "delete-part-button"
    )
    ?.addEventListener(
        "click",
        deletePart
    );


document
    .getElementById(
        "cancel-part-edit-button"
    )
    ?.addEventListener(
        "click",
        () => {

            editingPartId =
                null;


            openPage(
                "inventory"
            );

        }
    );


/* 거래 수정 새 부품 */

document
    .getElementById(
        "edit-add-part-button"
    )
    ?.addEventListener(
        "click",
        () => {

            addTransactionPartRow();

        }
    );


/* 거래 수정 저장 */

document
    .getElementById(
        "save-transaction-button"
    )
    ?.addEventListener(
        "click",
        saveTransaction
    );


/* 거래 수정 삭제 */

document
    .getElementById(
        "delete-transaction-button"
    )
    ?.addEventListener(
        "click",
        deleteTransaction
    );


/* 거래 수정 취소 */

document
    .getElementById(
        "cancel-transaction-edit-button"
    )
    ?.addEventListener(
        "click",
        () => {

            editingTransactionId =
                null;


            openPage(
                "inventory"
            );

        }
    );


/* 거래 수정 금액 표시 */

const editTransactionPrice =
    document.getElementById(
        "edit-transaction-price"
    );


editTransactionPrice
    ?.addEventListener(
        "input",
        () => {

            document.getElementById(
                "edit-transaction-price-text"
            ).textContent =
                formatInventoryKoreanMoney(
                    editTransactionPrice.value
                );

        }
    );


/* 최초 로드 */

loadParts();

loadInventoryTransactions();