import json
import tempfile
import unittest
from pathlib import Path
from publish_pages import publish, PUBLIC_FIELDS


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "data/uploads").mkdir(parents=True)
        (self.root / "docs/uploads").mkdir(parents=True)
        (self.root / "docs/uploads/old.jpg").write_bytes(b"old")
        (self.root / "docs/index.html").write_text("keep")
        (self.root / "data/uploads/photo.jpg").write_bytes(b"photo")
        self.good = {"id": 1, "이름": "CPU", "종류": 1, "고장여부": 1, "판매그룹": "",
                     "목표판매가": 15000, "매입가": "PRIVATE", "최저판매가": "PRIVATE",
                     "수리비": "PRIVATE", "매입그룹": "PRIVATE", "메모": "PRIVATE",
                     "이미지": "/uploads/photo.jpg"}

    def write(self, parts):
        (self.root / "data/parts.json").write_text(json.dumps(parts), encoding="utf-8")

    def test_filter_and_exact_allowlist(self):
        parts = [self.good]
        for index, changes in enumerate([{"판매그룹":"s1"}, {"고장여부":2},
                                        {"고장여부":3}, {"고장여부":True}, {"고장여부":1.5}], 2):
            parts.append(dict(self.good, id=index, **changes))
        missing = dict(self.good, id=9)
        del missing["판매그룹"]
        parts.append(missing)
        self.write(parts)
        result = publish(self.root)
        self.assertEqual(len(result), 1)
        self.assertEqual(set(result[0]), PUBLIC_FIELDS)
        self.assertEqual(result[0]["목표판매가"], 15000)
        self.assertNotIn("PRIVATE", (self.root / "docs/products.json").read_text(encoding="utf-8"))

    def test_images_and_sold_cleanup(self):
        (self.root / "data/uploads/private-cost.jpg").write_bytes(b"photo")
        self.write([dict(self.good, 이미지="/uploads/private-cost.jpg")])
        result = publish(self.root)
        self.assertNotIn("private-cost", result[0]["이미지"])
        self.assertEqual((self.root / "docs" / result[0]["이미지"]).read_bytes(), b"photo")
        self.assertFalse((self.root / "docs/uploads/old.jpg").exists())
        self.write([dict(self.good, 판매그룹="s1")])
        self.assertEqual(publish(self.root), [])
        self.assertEqual(list((self.root / "docs/uploads").iterdir()), [])
        self.assertTrue((self.root / "data/uploads/private-cost.jpg").exists())
        self.assertEqual((self.root / "docs/index.html").read_text(), "keep")

    def test_reject_unsafe_images(self):
        for image in ["/uploads/../secret.jpg", "/uploads/..\\secret.jpg",
                      "http://127.0.0.1:8000/uploads/a.jpg", "https://example.com/a.jpg",
                      "/uploads/test.svg", "/uploads/missing.jpg"]:
            with self.subTest(image=image):
                self.write([dict(self.good, 이미지=image)])
                self.assertEqual(publish(self.root), [])

    def test_missing_photos_are_hidden(self):
        (self.root / "data/uploads/empty.jpg").touch()
        missing = dict(self.good, id=2)
        del missing["이미지"]
        parts = [self.good, missing]
        for index, image in enumerate([None, "", "   ", "/uploads/empty.jpg"], 3):
            parts.append(dict(self.good, id=index, 이미지=image))
        self.write(parts)
        self.assertEqual([p["재고번호"] for p in publish(self.root)], [1])

    def test_bad_input_preserves_snapshot(self):
        self.write([self.good])
        publish(self.root)
        snapshot = (self.root / "docs/products.json").read_bytes()
        for invalid in ["{", "{}", "[null]"]:
            (self.root / "data/parts.json").write_text(invalid)
            with self.assertRaises((ValueError, TypeError)):
                publish(self.root)
            self.assertEqual((self.root / "docs/products.json").read_bytes(), snapshot)
        (self.root / "data/parts.json").unlink()
        with self.assertRaises(FileNotFoundError):
            publish(self.root)
        self.assertEqual((self.root / "docs/products.json").read_bytes(), snapshot)


if __name__ == "__main__":
    unittest.main()
