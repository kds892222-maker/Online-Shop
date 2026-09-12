import json

from datetime import date
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

PARTS_FILE = DATA_DIR / "parts.json"

TRANSACTIONS_FILE = DATA_DIR / "transactions.json"


# =========================================================
# 초기화
# =========================================================

def initialize():

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    if not PARTS_FILE.exists():

        save_json(
            PARTS_FILE,
            []
        )

    if not TRANSACTIONS_FILE.exists():

        save_json(
            TRANSACTIONS_FILE,
            []
        )


# =========================================================
# JSON
# =========================================================

def load_json(path):

    try:

        with path.open(
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except (
        FileNotFoundError,
        json.JSONDecodeError
    ):

        return []


def save_json(path, data):

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    with path.open(
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2
        )


# =========================================================
# 공통
# =========================================================

def get_next_id(items):

    ids = []

    for item in items:

        try:

            ids.append(
                int(
                    item["id"]
                )
            )

        except (
            KeyError,
            TypeError,
            ValueError
        ):

            pass

    if not ids:
        return 1

    return max(ids) + 1


def load_parts():

    return load_json(
        PARTS_FILE
    )


def load_transactions():

    return load_json(
        TRANSACTIONS_FILE
    )


def validate_amount(amount):

    if (
        not isinstance(
            amount,
            int
        )
        or isinstance(
            amount,
            bool
        )
    ):

        raise ValueError(
            "금액은 숫자여야 합니다."
        )

    if amount <= 0:

        raise ValueError(
            "금액은 0원보다 커야 합니다."
        )


def validate_part_data(data):

    if not isinstance(
        data,
        dict
    ):

        raise ValueError(
            "부품 형식이 잘못되었습니다."
        )

    name = str(
        data.get(
            "이름",
            ""
        )
    ).strip()

    if not name:

        raise ValueError(
            "부품 이름을 입력해주세요."
        )

    try:

        part_type = int(
            data.get(
                "종류"
            )
        )

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            "부품 종류가 잘못되었습니다."
        )

    try:

        status = int(
            data.get(
                "고장여부"
            )
        )

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            "고장여부가 잘못되었습니다."
        )

    if part_type not in range(
        1,
        12
    ):

        raise ValueError(
            "부품 종류가 잘못되었습니다."
        )

    if status not in (
        1,
        2,
        3
    ):

        raise ValueError(
            "고장여부가 잘못되었습니다."
        )

    return {
        "이름": name,
        "종류": part_type,
        "고장여부": status
    }


# =========================================================
# 매입 등록
# =========================================================

def add_purchase(data):

    if data.get(
        "구분"
    ) != 1:

        raise ValueError(
            "매입 거래가 아닙니다."
        )

    amount = data.get(
        "금액"
    )

    validate_amount(
        amount
    )

    related_parts = data.get(
        "관련부품",
        []
    )

    if (
        not isinstance(
            related_parts,
            list
        )
        or not related_parts
    ):

        raise ValueError(
            "관련부품을 입력해주세요."
        )

    parts = load_parts()

    transactions = (
        load_transactions()
    )

    transaction_id = (
        get_next_id(
            transactions
        )
    )

    transaction_group = (
        f"b{transaction_id}"
    )

    next_part_id = (
        get_next_id(
            parts
        )
    )

    created_ids = []

    for input_part in related_parts:

        part_data = (
            validate_part_data(
                input_part
            )
        )

        new_part = {
            "id":
                next_part_id,

            "매입그룹":
                transaction_group,

            "판매그룹":
                "",

            "종류":
                part_data["종류"],

            "고장여부":
                part_data[
                    "고장여부"
                ],

            "이름":
                part_data["이름"]
        }

        parts.append(
            new_part
        )

        created_ids.append(
            next_part_id
        )

        next_part_id += 1

    transaction = {
        "id":
            transaction_id,

        "구분":
            1,

        "거래그룹":
            transaction_group,

        "금액":
            amount,

        "날짜":
            date.today().isoformat(),

        "메모":
            str(
                data.get(
                    "메모",
                    ""
                )
            ),

        "관련부품":
            created_ids
    }

    transactions.append(
        transaction
    )

    save_json(
        PARTS_FILE,
        parts
    )

    save_json(
        TRANSACTIONS_FILE,
        transactions
    )

    return transaction


# =========================================================
# 판매 등록
# =========================================================

def add_sale(data):

    amount = data.get(
        "금액"
    )

    validate_amount(
        amount
    )

    raw_ids = data.get(
        "관련부품",
        []
    )

    if (
        not isinstance(
            raw_ids,
            list
        )
        or not raw_ids
    ):

        raise ValueError(
            "판매할 부품을 선택해주세요."
        )

    try:

        selected_ids = [
            int(value)
            for value
            in raw_ids
        ]

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            "관련부품 형식이 잘못되었습니다."
        )

    parts = load_parts()

    transactions = (
        load_transactions()
    )

    transaction_id = (
        get_next_id(
            transactions
        )
    )

    transaction_group = (
        f"s{transaction_id}"
    )

    part_map = {
        int(part["id"]):
            part
        for part
        in parts
    }

    for part_id in selected_ids:

        if part_id not in part_map:

            raise ValueError(
                f"{part_id}번 부품이 없습니다."
            )

        part = part_map[
            part_id
        ]

        if part.get(
            "판매그룹"
        ):

            raise ValueError(
                f"{part_id}번 부품은 이미 판매되었습니다."
            )

    for part_id in selected_ids:

        part_map[
            part_id
        ]["판매그룹"] = (
            transaction_group
        )

    transaction = {
        "id":
            transaction_id,

        "구분":
            2,

        "거래그룹":
            transaction_group,

        "금액":
            amount,

        "날짜":
            date.today().isoformat(),

        "메모":
            str(
                data.get(
                    "메모",
                    ""
                )
            ),

        "관련부품":
            selected_ids
    }

    transactions.append(
        transaction
    )

    save_json(
        PARTS_FILE,
        parts
    )

    save_json(
        TRANSACTIONS_FILE,
        transactions
    )

    return transaction


# =========================================================
# 부품 수정
# =========================================================

def update_part(
    part_id,
    data
):

    parts = load_parts()

    target = None

    for part in parts:

        if int(
            part["id"]
        ) == int(
            part_id
        ):

            target = part
            break

    if target is None:

        raise ValueError(
            "부품을 찾을 수 없습니다."
        )

    new_data = (
        validate_part_data(
            data
        )
    )

    target["이름"] = (
        new_data["이름"]
    )

    target["종류"] = (
        new_data["종류"]
    )

    target["고장여부"] = (
        new_data["고장여부"]
    )

    save_json(
        PARTS_FILE,
        parts
    )

    return target


# =========================================================
# 부품 삭제
# =========================================================

def delete_part(
    part_id
):

    part_id = int(
        part_id
    )

    parts = load_parts()

    transactions = (
        load_transactions()
    )

    target = next(
        (
            part
            for part
            in parts
            if int(
                part["id"]
            ) == part_id
        ),
        None
    )

    if target is None:

        raise ValueError(
            "부품을 찾을 수 없습니다."
        )

    parts = [
        part
        for part
        in parts
        if int(
            part["id"]
        ) != part_id
    ]

    for transaction in transactions:

        related = transaction.get(
            "관련부품",
            []
        )

        if not isinstance(
            related,
            list
        ):

            continue

        transaction[
            "관련부품"
        ] = [
            value
            for value
            in related
            if int(value)
            != part_id
        ]

    save_json(
        PARTS_FILE,
        parts
    )

    save_json(
        TRANSACTIONS_FILE,
        transactions
    )

    return target


# =========================================================
# 거래 수정
# =========================================================

def update_transaction(
    transaction_id,
    data
):

    transaction_id = int(
        transaction_id
    )

    parts = load_parts()

    transactions = (
        load_transactions()
    )

    transaction = next(
        (
            item
            for item
            in transactions
            if int(
                item["id"]
            ) == transaction_id
        ),
        None
    )

    if transaction is None:

        raise ValueError(
            "거래를 찾을 수 없습니다."
        )

    try:

        new_type = int(
            data.get(
                "구분"
            )
        )

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            "구분이 잘못되었습니다."
        )

    if new_type not in (
        1,
        2
    ):

        raise ValueError(
            "구분은 매입 또는 판매여야 합니다."
        )

    amount = data.get(
        "금액"
    )

    validate_amount(
        amount
    )

    raw_related = data.get(
        "관련부품",
        []
    )

    if (
        not isinstance(
            raw_related,
            list
        )
        or not raw_related
    ):

        raise ValueError(
            "관련부품을 한 개 이상 입력해주세요."
        )

    prepared_rows = []

    for raw_part in raw_related:

        part_data = (
            validate_part_data(
                raw_part
            )
        )

        existing_id = raw_part.get(
            "id"
        )

        if (
            existing_id
            is not None
        ):

            try:

                existing_id = int(
                    existing_id
                )

            except (
                TypeError,
                ValueError
            ):

                raise ValueError(
                    "부품 ID가 잘못되었습니다."
                )

        prepared_rows.append({
            "id":
                existing_id,

            "이름":
                part_data["이름"],

            "종류":
                part_data["종류"],

            "고장여부":
                part_data[
                    "고장여부"
                ]
        })

    existing_input_ids = [
        row["id"]
        for row
        in prepared_rows
        if row["id"]
        is not None
    ]

    if (
        len(existing_input_ids)
        != len(
            set(
                existing_input_ids
            )
        )
    ):

        raise ValueError(
            "같은 부품이 중복되어 있습니다."
        )

    old_type = int(
        transaction["구분"]
    )

    old_group = (
        transaction[
            "거래그룹"
        ]
    )

    old_related_ids = [
        int(value)
        for value
        in transaction.get(
            "관련부품",
            []
        )
    ]

    new_group = (
        f"b{transaction_id}"
        if new_type == 1
        else f"s{transaction_id}"
    )

    part_map = {
        int(part["id"]):
            part
        for part
        in parts
    }

    for existing_id in existing_input_ids:

        if (
            existing_id
            not in part_map
        ):

            raise ValueError(
                f"{existing_id}번 부품을 찾을 수 없습니다."
            )

    removed_ids = [
        part_id
        for part_id
        in old_related_ids
        if part_id
        not in existing_input_ids
    ]

    delete_ids = set()

    for part_id in removed_ids:

        part = part_map.get(
            part_id
        )

        if not part:
            continue

        if old_type == 1:

            if part.get(
                "판매그룹"
            ):

                raise ValueError(
                    f"{part['이름']} 부품은 이미 판매되어 "
                    "매입 거래에서 제거할 수 없습니다."
                )

            delete_ids.add(
                part_id
            )

        else:

            if (
                part.get(
                    "판매그룹"
                )
                == old_group
            ):

                part[
                    "판매그룹"
                ] = ""

    if delete_ids:

        parts = [
            part
            for part
            in parts
            if int(
                part["id"]
            )
            not in delete_ids
        ]

        part_map = {
            int(part["id"]):
                part
            for part
            in parts
        }

    new_related_ids = []

    for row in prepared_rows:

        if row["id"] is None:
            continue

        if (
            row["id"]
            not in part_map
        ):

            raise ValueError(
                f"{row['id']}번 부품을 찾을 수 없습니다."
            )

        part = part_map[
            row["id"]
        ]

        part["이름"] = (
            row["이름"]
        )

        part["종류"] = (
            row["종류"]
        )

        part["고장여부"] = (
            row["고장여부"]
        )

        if new_type == 1:

            part[
                "매입그룹"
            ] = new_group

            if (
                old_type == 2
                and part.get(
                    "판매그룹"
                ) == old_group
            ):

                part[
                    "판매그룹"
                ] = ""

        else:

            current_sale_group = (
                part.get(
                    "판매그룹",
                    ""
                )
            )

            if (
                current_sale_group
                not in (
                    "",
                    old_group,
                    new_group
                )
            ):

                raise ValueError(
                    f"{part['이름']} 부품은 다른 판매거래에 연결되어 있습니다."
                )

            part[
                "판매그룹"
            ] = new_group

        new_related_ids.append(
            row["id"]
        )

    next_part_id = (
        get_next_id(
            parts
        )
    )

    for row in prepared_rows:

        if (
            row["id"]
            is not None
        ):

            continue

        if new_type == 1:

            buy_group = (
                new_group
            )

            sell_group = ""

        else:

            buy_group = ""

            sell_group = (
                new_group
            )

        new_part = {
            "id":
                next_part_id,

            "매입그룹":
                buy_group,

            "판매그룹":
                sell_group,

            "종류":
                row["종류"],

            "고장여부":
                row["고장여부"],

            "이름":
                row["이름"]
        }

        parts.append(
            new_part
        )

        new_related_ids.append(
            next_part_id
        )

        next_part_id += 1

    transaction[
        "구분"
    ] = new_type

    transaction[
        "거래그룹"
    ] = new_group

    transaction[
        "금액"
    ] = amount

    transaction[
        "메모"
    ] = str(
        data.get(
            "메모",
            ""
        )
    )

    transaction[
        "관련부품"
    ] = new_related_ids

    save_json(
        PARTS_FILE,
        parts
    )

    save_json(
        TRANSACTIONS_FILE,
        transactions
    )

    return transaction


# =========================================================
# 거래 삭제
# =========================================================

def delete_transaction(
    transaction_id
):

    transaction_id = int(
        transaction_id
    )

    parts = load_parts()

    transactions = (
        load_transactions()
    )

    transaction = next(
        (
            item
            for item
            in transactions
            if int(
                item["id"]
            ) == transaction_id
        ),
        None
    )

    if transaction is None:

        raise ValueError(
            "거래를 찾을 수 없습니다."
        )

    transaction_type = int(
        transaction[
            "구분"
        ]
    )

    transaction_group = (
        transaction[
            "거래그룹"
        ]
    )

    related_ids = [
        int(value)
        for value
        in transaction.get(
            "관련부품",
            []
        )
    ]

    if transaction_type == 1:

        for part in parts:

            if (
                int(part["id"])
                in related_ids
                and part.get(
                    "판매그룹"
                )
            ):

                raise ValueError(
                    f"{part['이름']} 부품이 이미 판매되어 "
                    "이 매입거래를 삭제할 수 없습니다."
                )

        parts = [
            part
            for part
            in parts
            if int(
                part["id"]
            )
            not in related_ids
        ]

    else:

        for part in parts:

            if (
                int(part["id"])
                in related_ids
                and part.get(
                    "판매그룹"
                )
                == transaction_group
            ):

                part[
                    "판매그룹"
                ] = ""

    transactions = [
        item
        for item
        in transactions
        if int(
            item["id"]
        )
        != transaction_id
    ]

    save_json(
        PARTS_FILE,
        parts
    )

    save_json(
        TRANSACTIONS_FILE,
        transactions
    )

    return transaction