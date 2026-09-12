"""Export a customer-safe snapshot; never imports or starts the admin server."""
import hashlib
import json
import shutil
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_FIELDS = {"이름", "종류", "목표판매가", "이미지", "재고번호"}


def public_image(image, source_dir, target_dir):
    if not isinstance(image, str) or not image.startswith("/uploads/"):
        return ""
    name = image[len("/uploads/"):]
    if not name or "/" in name or "\\" in name or ":" in name:
        return ""
    source = source_dir / name
    if source.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return ""
    if source.is_symlink() or not source.is_file():
        return ""
    if source.resolve().parent != source_dir.resolve():
        return ""
    content = source.read_bytes()
    if not content:
        return ""
    filename = hashlib.sha256(content).hexdigest() + source.suffix.lower()
    (target_dir / filename).write_bytes(content)
    return "uploads/" + filename


def publish(base_dir=BASE_DIR):
    base_dir = Path(base_dir).resolve()
    # Missing or corrupt input must not erase the last successful export.
    parts = json.loads((base_dir / "data/parts.json").read_text(encoding="utf-8-sig"))
    if not isinstance(parts, list) or any(not isinstance(p, dict) for p in parts):
        raise ValueError("parts.json must contain a list of product objects")
    docs = base_dir / "docs"
    if docs.is_symlink() or docs.resolve() != base_dir / "docs":
        raise ValueError("docs must be a local directory")
    docs.mkdir(exist_ok=True)
    uploads = docs / "uploads"
    if uploads.is_symlink() or uploads.resolve() != docs / "uploads":
        raise ValueError("docs/uploads must be a local directory")
    with tempfile.TemporaryDirectory(prefix="pages-", dir=base_dir) as temporary:
        staged = Path(temporary)
        staged_uploads = staged / "uploads"
        staged_uploads.mkdir()
        products = []
        for part in parts:
            # Fail closed for missing / unknown status and sale fields.
            if type(part.get("고장여부")) not in (int, str) or part["고장여부"] not in (1, "1"):
                continue
            if "판매그룹" not in part or part["판매그룹"] not in ("", None):
                continue
            stock_id, kind, name = part.get("id"), part.get("종류"), part.get("이름")
            if type(stock_id) is not int or stock_id <= 0:
                raise ValueError("Invalid stock number")
            if type(kind) is not int or kind not in range(1, 12) or not isinstance(name, str):
                raise ValueError("Invalid public product name/type")
            raw_price = part.get("목표판매가")
            if raw_price in (None, ""):
                price = 0
            elif type(raw_price) is int and raw_price >= 0:
                price = raw_price
            elif isinstance(raw_price, str) and raw_price.isdecimal():
                price = int(raw_price)
            else:
                raise ValueError("Invalid target sale price")
            image = public_image(part.get("이미지"), base_dir / "data/uploads", staged_uploads)
            if not image:
                continue
            products.append({
                "이름": name, "종류": kind, "목표판매가": price,
                "이미지": image,
                "재고번호": stock_id,
            })
        if len({p["재고번호"] for p in products}) != len(products):
            raise ValueError("Duplicate stock number")
        staged_json = staged / "products.json"
        staged_json.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        # All validation and copies succeeded; delete only the checked export folder.
        if uploads.exists():
            shutil.rmtree(uploads)
        shutil.move(str(staged_uploads), str(uploads))
        staged_json.replace(docs / "products.json")
    (docs / ".nojekyll").touch()
    print(f"GitHub Pages 공개 재고 {len(products)}개 생성 완료")
    print("git add docs → git commit → git push 순서로 게시하세요.")
    return products


if __name__ == "__main__":
    publish()
