from pathlib import Path
import hashlib
import hmac
import secrets
import time

from fastapi import (
    FastAPI,
    HTTPException,
    Request
)

from fastapi.responses import (
    FileResponse,
    JSONResponse,
    RedirectResponse
)

from fastapi.staticfiles import (
    StaticFiles
)

import database
import pricing_backend


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
)


WAP_DIR = (
    BASE_DIR / "wap"
)

CSS_DIR = (
    WAP_DIR / "css"
)

JS_DIR = (
    WAP_DIR / "js"
)

UPLOAD_DIR = (
    BASE_DIR / "data" / "uploads"
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


ADMIN_PASSWORD_HASH = (
    "4f74b04572fedf22bf02d789c01410cd"
    "6d13bfdf78623c521327f91d9d371fd1"
)

SESSION_COOKIE_NAME = (
    "inventory_admin_session"
)

SESSION_SECRET = (
    secrets.token_bytes(32)
)

PUBLIC_PATHS = {
    "/login",
    "/customer",
    "/api/login",
    "/api/customer/parts",
    "/css/customer.css",
    "/js/customer.js",
    "/favicon.ico"
}


app = FastAPI()


database.initialize()
pricing_backend.install(database)


app.mount(
    "/css",
    StaticFiles(
        directory=CSS_DIR
    ),
    name="css"
)


app.mount(
    "/js",
    StaticFiles(
        directory=JS_DIR
    ),
    name="js"
)


app.mount(
    "/uploads",
    StaticFiles(
        directory=UPLOAD_DIR
    ),
    name="uploads"
)


def admin_session_token():

    return hmac.new(
        SESSION_SECRET,
        b"inventory-admin",
        hashlib.sha256
    ).hexdigest()


def is_admin_request(
    request: Request
):

    cookie = request.cookies.get(
        SESSION_COOKIE_NAME,
        ""
    )

    if not cookie:
        return False

    return hmac.compare_digest(
        cookie,
        admin_session_token()
    )


@app.middleware("http")
async def protect_admin(
    request: Request,
    call_next
):

    path = request.url.path

    if (
        path in PUBLIC_PATHS
        or path.startswith("/uploads/")
    ):
        return await call_next(request)

    if is_admin_request(request):
        return await call_next(request)

    if path.startswith("/api/"):
        return JSONResponse(
            status_code=401,
            content={
                "detail": "관리자 로그인이 필요합니다."
            }
        )

    return RedirectResponse(
        url="/login",
        status_code=303
    )


@app.get("/login")
def login_page(
    request: Request
):

    if is_admin_request(request):
        return RedirectResponse(
            url="/",
            status_code=303
        )

    return FileResponse(
        WAP_DIR / "login.htm"
    )


@app.post("/api/login")
async def login(
    request: Request
):

    try:
        data = await request.json()
    except Exception:
        data = {}

    password = str(
        data.get(
            "password",
            ""
        )
    )

    auto_login = bool(
        data.get(
            "auto_login",
            False
        )
    )

    password_hash = hashlib.sha256(
        password.encode("utf-8")
    ).hexdigest()

    if not hmac.compare_digest(
        password_hash,
        ADMIN_PASSWORD_HASH
    ):
        raise HTTPException(
            status_code=401,
            detail="비밀번호가 올바르지 않습니다."
        )

    response = JSONResponse(
        content={
            "success": True,
            "auto_login": auto_login
        }
    )

    cookie_options = {
        "key": SESSION_COOKIE_NAME,
        "value": admin_session_token(),
        "httponly": True,
        "samesite": "strict",
        "secure": False,
        "path": "/"
    }

    if auto_login:
        cookie_options["max_age"] = (
            60 * 60 * 24 * 30
        )

    response.set_cookie(
        **cookie_options
    )

    return response


@app.post("/api/logout")
def logout():

    response = JSONResponse(
        content={
            "success": True
        }
    )

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/"
    )

    return response


@app.get("/")
def main_page():

    return FileResponse(
        WAP_DIR / "main.htm"
    )


@app.get("/customer")
def customer_page():

    return FileResponse(
        WAP_DIR / "customer.htm"
    )


# =========================
# 부품
# =========================

@app.get("/api/parts")
def get_parts():

    return database.load_parts()


@app.get("/api/customer/parts")
def get_customer_parts():

    parts = database.load_parts()

    result = []

    for part in parts:

        if part.get(
            "판매그룹"
        ):
            continue

        if int(
            part.get(
                "고장여부",
                3
            )
        ) != 1:
            continue

        result.append({
            "id": part.get("id"),
            "이름": part.get("이름", ""),
            "종류": part.get("종류"),
            "상태": "정상",
            "판매가": int(
                part.get(
                    "목표판매가",
                    0
                )
                or 0
            ),
            "이미지": part.get(
                "이미지",
                ""
            )
        })

    return result


@app.post("/api/parts/{part_id}/image")
async def upload_part_image(
    part_id: int,
    request: Request
):

    content_type = (
        request.headers
        .get(
            "content-type",
            ""
        )
        .split(";", 1)[0]
        .strip()
        .lower()
    )

    extension_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp"
    }

    extension = extension_map.get(
        content_type
    )

    if extension is None:
        raise HTTPException(
            status_code=400,
            detail="JPG, PNG, WEBP 이미지만 등록할 수 있습니다."
        )

    image_data = await request.body()

    if not image_data:
        raise HTTPException(
            status_code=400,
            detail="이미지 파일이 비어 있습니다."
        )

    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="이미지는 10MB 이하만 등록할 수 있습니다."
        )

    parts = database.load_parts()

    target = next(
        (
            part
            for part in parts
            if int(part.get("id"))
            == int(part_id)
        ),
        None
    )

    if target is None:
        raise HTTPException(
            status_code=404,
            detail="부품을 찾을 수 없습니다."
        )

    old_image = str(
        target.get(
            "이미지",
            ""
        )
        or ""
    )

    if old_image.startswith(
        "/uploads/"
    ):
        old_path = (
            UPLOAD_DIR
            / old_image.removeprefix(
                "/uploads/"
            )
        )

        if old_path.exists():
            try:
                old_path.unlink()
            except OSError:
                pass

    filename = (
        f"part_{int(part_id)}_{time.time_ns()}{extension}"
    )

    file_path = (
        UPLOAD_DIR / filename
    )

    file_path.write_bytes(
        image_data
    )

    image_url = (
        f"/uploads/{filename}"
    )

    target["이미지"] = image_url

    database.save_json(
        database.PARTS_FILE,
        parts
    )

    return {
        "success": True,
        "image": image_url
    }


@app.delete("/api/parts/{part_id}/image")
def delete_part_image(
    part_id: int
):

    parts = database.load_parts()

    target = next(
        (
            part
            for part in parts
            if int(part.get("id"))
            == int(part_id)
        ),
        None
    )

    if target is None:
        raise HTTPException(
            status_code=404,
            detail="부품을 찾을 수 없습니다."
        )

    old_image = str(
        target.get(
            "이미지",
            ""
        )
        or ""
    )

    if old_image.startswith(
        "/uploads/"
    ):
        old_path = (
            UPLOAD_DIR
            / old_image.removeprefix(
                "/uploads/"
            )
        )

        if old_path.exists():
            try:
                old_path.unlink()
            except OSError:
                pass

    target["이미지"] = ""

    database.save_json(
        database.PARTS_FILE,
        parts
    )

    return {
        "success": True
    }


@app.put("/api/parts/{part_id}")
def update_part(
    part_id: int,
    data: dict
):

    try:

        return database.update_part(
            part_id,
            data
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.delete("/api/parts/{part_id}")
def delete_part(
    part_id: int
):

    try:

        deleted = database.delete_part(
            part_id
        )

        return {
            "success": True,
            "deleted": deleted
        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# =========================
# 거래
# =========================

@app.get("/api/transactions")
def get_transactions():

    return database.load_transactions()


@app.post("/api/transactions")
def add_transaction(
    data: dict
):

    try:

        transaction_type = data.get(
            "구분"
        )

        if transaction_type == 1:

            return database.add_purchase(
                data
            )

        if transaction_type == 2:

            return database.add_sale(
                data
            )

        raise ValueError(
            "구분은 매입 또는 판매여야 합니다."
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.put("/api/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int,
    data: dict
):

    try:

        return database.update_transaction(
            transaction_id,
            data
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int
):

    try:

        deleted = database.delete_transaction(
            transaction_id
        )

        return {
            "success": True,
            "deleted": deleted
        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
