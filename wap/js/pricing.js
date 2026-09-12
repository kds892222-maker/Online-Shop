const PRICE_FIELD_DEFS = [
    {
        key: "목표판매가",
        editId: "edit-target-price",
        label: "목표판매가"
    },
    {
        key: "최저판매가",
        editId: "edit-minimum-price",
        label: "최저판매가"
    },
    {
        key: "수리비",
        editId: "edit-repair-cost",
        label: "수리비"
    }
];


function pricingMoney(value) {

    return (
        Number(value || 0)
            .toLocaleString("ko-KR")
        + "원"
    );

}


function safePrice(value) {

    return Math.max(
        0,
        Math.floor(
            Number(value) || 0
        )
    );

}


/* =========================================================
   부품 수정 화면 가격 입력
========================================================= */

function addPricingFieldsToEditPage() {

    const statusGroup =
        document
            .getElementById(
                "edit-part-status"
            )
            ?.closest(
                ".form-group"
            );


    if (!statusGroup) {
        return;
    }


    let anchor = statusGroup;


    for (const def of PRICE_FIELD_DEFS) {

        if (
            document.getElementById(
                def.editId
            )
        ) {
            continue;
        }


        const group =
            document.createElement(
                "div"
            );

        group.className =
            "form-group";

        group.innerHTML = `
            <label for="${def.editId}">
                ${def.label}
            </label>

            <input
                id="${def.editId}"
                type="number"
                min="0"
                step="1"
                value="0"
            >
        `;


        anchor.after(
            group
        );

        anchor = group;

    }

}


/* =========================================================
   재고 표 가격 표시
========================================================= */

function addPricingColumnsToTable() {

    const headerRow =
        document.querySelector(
            "#parts-result-table thead tr"
        );


    if (!headerRow) {
        return;
    }


    const existingHeaders = Array.from(
        headerRow.querySelectorAll("th")
    ).map(th => th.textContent.trim());


    if (
        PRICE_FIELD_DEFS.every(
            def => existingHeaders.includes(def.label)
        )
    ) {
        return;
    }


    const buyGroupHeader =
        Array.from(
            headerRow.querySelectorAll("th")
        ).find(
            th => th.textContent.trim() === "매입그룹"
        );


    if (!buyGroupHeader) {
        return;
    }


    for (const def of PRICE_FIELD_DEFS) {

        if (
            existingHeaders.includes(
                def.label
            )
        ) {
            continue;
        }


        const th =
            document.createElement(
                "th"
            );

        th.textContent =
            def.label;

        headerRow.insertBefore(
            th,
            buyGroupHeader
        );

    }

}


function addPricingCellsToRenderedRows() {

    const rows =
        document.querySelectorAll(
            "#parts-table tr"
        );


    for (const row of rows) {

        if (
            row.querySelector(
                "td[data-price-field]"
            )
        ) {
            continue;
        }


        const id =
            Number(
                row.children[0]
                    ?.textContent
                    ?.trim()
            );


        const part =
            cachedParts.find(
                item =>
                    Number(item.id)
                    === id
            );


        if (!part) {
            continue;
        }


        const cells =
            Array.from(
                row.children
            );

        const buyGroupCell =
            cells[4];


        if (!buyGroupCell) {
            continue;
        }


        for (const def of PRICE_FIELD_DEFS) {

            const td =
                document.createElement(
                    "td"
                );

            td.dataset.priceField =
                def.key;

            td.textContent =
                pricingMoney(
                    part[def.key]
                );

            row.insertBefore(
                td,
                buyGroupCell
            );

        }

    }

}


/* =========================================================
   모바일 재고 카드 버튼
========================================================= */

function addMobileActionsToRows() {

    const rows =
        document.querySelectorAll(
            "#parts-table tr"
        );


    for (const row of rows) {

        if (
            row.querySelector(
                ".mobile-card-actions"
            )
        ) {
            continue;
        }


        const id = Number(
            row.children[0]
                ?.textContent
                ?.trim()
        );


        if (!id) {
            continue;
        }


        const actionCell =
            document.createElement(
                "td"
            );

        actionCell.className =
            "mobile-card-actions";


        const detailButton =
            document.createElement(
                "button"
            );

        detailButton.type = "button";
        detailButton.className =
            "mobile-detail-button secondary-button";
        detailButton.textContent =
            "자세히보기";


        const editButton =
            document.createElement(
                "button"
            );

        editButton.type = "button";
        editButton.className =
            "mobile-edit-button";
        editButton.textContent =
            "수정";


        detailButton.addEventListener(
            "click",
            () => {

                const expanded =
                    row.classList.toggle(
                        "mobile-expanded"
                    );

                detailButton.textContent =
                    expanded
                        ? "접기"
                        : "자세히보기";

            }
        );


        editButton.addEventListener(
            "click",
            () => {

                if (
                    typeof window.openPartEdit
                    === "function"
                ) {
                    window.openPartEdit(id);
                }

            }
        );


        actionCell.append(
            detailButton,
            editButton
        );

        row.appendChild(
            actionCell
        );

    }

}


function schedulePricingCells() {

    requestAnimationFrame(
        () => {
            addPricingColumnsToTable();
            addPricingCellsToRenderedRows();
            addMobileActionsToRows();
        }
    );

}


/* =========================================================
   부품 수정 가격 불러오기 / 저장
========================================================= */

function fillPartEditPrices(partId) {

    const part =
        cachedParts.find(
            item =>
                Number(item.id)
                === Number(partId)
        );


    if (!part) {
        return;
    }


    for (const def of PRICE_FIELD_DEFS) {

        const input =
            document.getElementById(
                def.editId
            );

        if (input) {

            input.value =
                safePrice(
                    part[def.key]
                );

        }

    }

}


function getPricePayloadFromPartEdit() {

    const result = {};


    for (const def of PRICE_FIELD_DEFS) {

        result[def.key] =
            safePrice(
                document.getElementById(
                    def.editId
                )?.value
            );

    }


    return result;

}


const originalOpenPartEdit =
    window.openPartEdit;


if (
    typeof originalOpenPartEdit
    === "function"
) {

    window.openPartEdit = function (partId) {

        originalOpenPartEdit(
            partId
        );

        fillPartEditPrices(
            partId
        );

    };

}


async function pricingSavePart() {

    if (
        editingPartId === null
    ) {
        return;
    }


    const message =
        document.getElementById(
            "edit-part-message"
        );


    const name =
        document
            .getElementById(
                "edit-part-name"
            )
            .value
            .trim();


    if (!name) {

        message.textContent =
            "이름을 입력해주세요.";

        return;

    }


    const payload = {

        "이름": name,

        "종류": Number(
            document.getElementById(
                "edit-part-type"
            ).value
        ),

        "고장여부": Number(
            document.getElementById(
                "edit-part-status"
            ).value
        ),

        ...getPricePayloadFromPartEdit()

    };


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
                        JSON.stringify(
                            payload
                        )
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


        editingPartId = null;

        await loadParts();

        openPage(
            "inventory"
        );

        schedulePricingCells();

    }

    catch (error) {

        console.error(error);

        message.textContent =
            "서버 연결 실패";

    }

}


/* =========================================================
   이벤트 보완
========================================================= */

const savePartButton =
    document.getElementById(
        "save-part-button"
    );


if (savePartButton) {

    savePartButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopImmediatePropagation();

            pricingSavePart();

        },
        true
    );

}


/* =========================================================
   재고 목록이 다시 그려질 때 자동 보정
========================================================= */

const partsTableBody =
    document.getElementById(
        "parts-table"
    );


if (partsTableBody) {

    const partsObserver =
        new MutationObserver(
            () => {
                schedulePricingCells();
            }
        );


    partsObserver.observe(
        partsTableBody,
        {
            childList: true
        }
    );

}


/* =========================================================
   최초 적용
========================================================= */

addPricingFieldsToEditPage();
addPricingColumnsToTable();
schedulePricingCells();
