function summaryMoney(value) {

    const number =
        Number(value) || 0;


    return (
        number.toLocaleString(
            "ko-KR"
        )
        + "원"
    );
}


/* =====================================
   거래 금액 계산
===================================== */

function updateSummary(transactions) {

    let totalBuy = 0;

    let totalSell = 0;


    for (
        const transaction
        of transactions
    ) {

        const type =
            Number(
                transaction["구분"]
            );


        const amount =
            Number(
                transaction["금액"]
            ) || 0;


        if (type === 1) {

            totalBuy += amount;

        }


        if (type === 2) {

            totalSell += amount;

        }

    }


    const totalBuyElement =
        document.getElementById(
            "total-buy"
        );


    const totalSellElement =
        document.getElementById(
            "total-sell"
        );


    const totalProfitElement =
        document.getElementById(
            "total-profit"
        );


    if (totalBuyElement) {

        totalBuyElement.textContent =
            summaryMoney(
                totalBuy
            );

    }


    if (totalSellElement) {

        totalSellElement.textContent =
            summaryMoney(
                totalSell
            );

    }


    if (totalProfitElement) {

        totalProfitElement.textContent =
            summaryMoney(
                totalSell
                - totalBuy
            );

    }

}


/* =====================================
   부품 수
===================================== */

function updateSummaryPartCount(parts) {

    const element =
        document.getElementById(
            "total-parts"
        );


    if (!element) {
        return;
    }


    element.textContent =
        parts.length
        + "개";

}


/* =====================================
   서버에서 직접 새로고침
===================================== */

async function refreshDashboardSummary() {

    try {

        const [
            transactionsResponse,
            partsResponse
        ] =
            await Promise.all([

                fetch(
                    "/api/transactions"
                ),

                fetch(
                    "/api/parts"
                )

            ]);


        if (
            !transactionsResponse.ok
        ) {

            throw new Error(
                "거래내역 로드 실패"
            );

        }


        if (
            !partsResponse.ok
        ) {

            throw new Error(
                "부품 목록 로드 실패"
            );

        }


        const transactions =
            await transactionsResponse.json();


        const parts =
            await partsResponse.json();


        updateSummary(
            transactions
        );


        updateSummaryPartCount(
            parts
        );


        console.log(
            "요약 갱신:",
            {
                transactions,
                parts
            }
        );

    }

    catch (error) {

        console.error(
            "요약 갱신 실패:",
            error
        );

    }

}


/* 처음 페이지 열 때 자동 실행 */

refreshDashboardSummary();