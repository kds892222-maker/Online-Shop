PRICE_FIELDS = (
    "목표판매가",
    "최저판매가",
    "수리비"
)


def _read_prices(data):

    if not isinstance(data, dict):
        raise ValueError(
            "부품 형식이 잘못되었습니다."
        )

    result = {}

    for field in PRICE_FIELDS:

        raw_value = data.get(
            field,
            0
        )

        if raw_value in (
            "",
            None
        ):
            raw_value = 0

        try:
            value = int(raw_value)
        except (
            TypeError,
            ValueError
        ):
            raise ValueError(
                f"{field}은 숫자여야 합니다."
            )

        if value < 0:
            raise ValueError(
                f"{field}은 0원 이상이어야 합니다."
            )

        result[field] = value

    return result


def install(database):

    original_load_parts = (
        database.load_parts
    )

    original_add_purchase = (
        database.add_purchase
    )

    original_update_part = (
        database.update_part
    )

    original_update_transaction = (
        database.update_transaction
    )


    def load_parts_with_prices():

        parts = original_load_parts()

        for part in parts:

            for field in PRICE_FIELDS:

                try:
                    part[field] = int(
                        part.get(
                            field,
                            0
                        )
                        or 0
                    )
                except (
                    TypeError,
                    ValueError
                ):
                    part[field] = 0

        return parts


    def save_prices_for_ids(
        part_ids,
        input_parts
    ):

        parts = load_parts_with_prices()

        part_map = {
            int(part["id"]): part
            for part in parts
        }

        for part_id, input_part in zip(
            part_ids,
            input_parts
        ):

            target = part_map.get(
                int(part_id)
            )

            if target is None:
                continue

            prices = _read_prices(
                input_part
            )

            for field, value in prices.items():
                target[field] = value

        database.save_json(
            database.PARTS_FILE,
            parts
        )


    def add_purchase_with_prices(data):

        input_parts = data.get(
            "관련부품",
            []
        )

        for input_part in input_parts:
            _read_prices(input_part)

        transaction = (
            original_add_purchase(
                data
            )
        )

        save_prices_for_ids(
            transaction.get(
                "관련부품",
                []
            ),
            input_parts
        )

        return transaction


    def update_part_with_prices(
        part_id,
        data
    ):

        prices = _read_prices(
            data
        )

        original_update_part(
            part_id,
            data
        )

        parts = load_parts_with_prices()

        target = next(
            (
                part
                for part in parts
                if int(part["id"])
                == int(part_id)
            ),
            None
        )

        if target is None:
            raise ValueError(
                "부품을 찾을 수 없습니다."
            )

        for field, value in prices.items():
            target[field] = value

        database.save_json(
            database.PARTS_FILE,
            parts
        )

        return target


    def update_transaction_with_prices(
        transaction_id,
        data
    ):

        input_parts = data.get(
            "관련부품",
            []
        )

        for input_part in input_parts:
            _read_prices(input_part)

        transaction = (
            original_update_transaction(
                transaction_id,
                data
            )
        )

        save_prices_for_ids(
            transaction.get(
                "관련부품",
                []
            ),
            input_parts
        )

        return transaction


    database.load_parts = (
        load_parts_with_prices
    )

    database.add_purchase = (
        add_purchase_with_prices
    )

    database.update_part = (
        update_part_with_prices
    )

    database.update_transaction = (
        update_transaction_with_prices
    )
