import re, shutil, subprocess, tempfile
from pathlib import Path
from decimal import Decimal
import pymupdf as fitz
from .schemas import Tender, LineItem, Requirement


class DocumentError(ValueError):
    pass


LABELS = {
    "name": r"(?:Товар|Наименование|Өнім|Тауар|Атауы)",
    "quantity": r"(?:Количество|Кол-во|Саны)",
    "unit": r"(?:Единица|Ед\. изм\.|Өлшем бірлігі)",
    "volume": r"(?:Объем|Объём|Фасовка|Көлемі)",
    "dimensions": r"(?:Размер|Размеры|Габариты|Өлшемі)",
    "color": r"(?:Цвет|Түсі)",
    "material": r"(?:Материал|Материалы)",
    "brand": r"(?:Бренд|Марка|Өндіруші)",
    "standard": r"(?:Стандарт|ГОСТ|СТ РК)",
    "certificate": r"(?:Документ|Сертификат|Құжат|Сертификаты)",
}
ATTR_NAMES = {
    "volume": "Фасовка / объём",
    "dimensions": "Размеры",
    "color": "Цвет",
    "material": "Материал",
    "brand": "Бренд",
    "standard": "Стандарт",
    "certificate": "Документ соответствия",
}


def number(text):
    clean = re.search(r"\d[\d\s\u00a0]*(?:[.,]\d+)?", text)
    return (
        Decimal(re.sub(r"\s", "", clean.group()).replace(",", ".")) if clean else None
    )


def extract_pdf(path: Path, allow_ocr: bool = True) -> list[dict]:
    try:
        doc = fitz.open(path)
    except Exception as exc:
        raise DocumentError("Не удалось открыть PDF. Проверьте формат файла.") from exc
    with doc:
        if doc.needs_pass:
            raise DocumentError("PDF защищён паролем. Загрузите доступную копию.")
        if not 1 <= len(doc) <= 100:
            raise DocumentError("PDF должен содержать от 1 до 100 страниц.")
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text(sort=True).strip()
            ocr = False
            tables = []
            if len(text) < 15:
                langs = []
                if allow_ocr and shutil.which("tesseract"):
                    try:
                        out = subprocess.run(
                            ["tesseract", "--list-langs"],
                            capture_output=True,
                            text=True,
                            timeout=5,
                        ).stdout
                        langs = [l for l in ["rus", "kaz"] if l in out.splitlines()]
                    except (OSError, subprocess.TimeoutExpired):
                        pass
                if langs:
                    with tempfile.TemporaryDirectory(prefix="qazbid-ocr-") as tmp:
                        img = Path(tmp) / "page.png"
                        page.get_pixmap(matrix=fitz.Matrix(2, 2)).save(img)
                        try:
                            result = subprocess.run(
                                [
                                    "tesseract",
                                    str(img),
                                    "stdout",
                                    "-l",
                                    "+".join(langs),
                                ],
                                capture_output=True,
                                text=True,
                                timeout=30,
                            )
                            text = result.stdout.strip()
                            ocr = True
                        except subprocess.TimeoutExpired:
                            raise DocumentError(
                                f"OCR страницы {i+1} превысил время ожидания"
                            )
                if len(text) < 15:
                    raise DocumentError(
                        f"Страница {i+1} не содержит доступного текста. Нужен OCR (Tesseract rus/kaz) или текстовый PDF."
                    )
            try:
                tables = [t.extract() for t in page.find_tables().tables]
            except Exception:
                pass
            pages.append(
                {"page": i + 1, "text": text[:60000], "tables": tables, "ocr": ocr}
            )
        return pages


def parse_tender(pages: list[dict]) -> Tender:
    t = Tender()
    current = None
    for p in pages:
        page_start = len(t.items)
        for raw in p["text"].splitlines():
            line = raw.strip()
            if not line:
                continue
            if re.search(r"СИНТЕТИЧЕСК|УЧЕБНЫЙ|СИНТЕТИКАЛЫҚ", line, re.I):
                t.synthetic = True
                t.source = "Синтетический учебный документ"
            if m := re.match(r"(?:Название|Тендер|Атауы)\s*:\s*(.+)", line, re.I):
                t.title = m[1]
                continue
            meta = {
                "identifier": r"(?:Номер|Идентификатор|Нөмірі)",
                "buyer": r"(?:Заказчик|Тапсырыс беруші)",
                "region": r"(?:Регион|Өңір)",
                "method": r"(?:Способ закупки|Сатып алу тәсілі)",
                "deadline": r"(?:Срок подачи|Өтінім мерзімі)",
                "delivery_date": r"(?:Дата поставки|Жеткізу күні)",
            }
            found = False
            for field, pattern in meta.items():
                if m := re.match(pattern + r"\s*:\s*(.+)", line, re.I):
                    setattr(t, field, m[1])
                    found = True
                    break
            if found:
                continue
            if m := re.match(
                r"(?:Бюджет|Бюджеті|Сумма закупки)\s*:\s*(.+)", line, re.I
            ):
                t.budget = number(m[1])
                continue
            if m := re.match(r"(?:Поставка|Доставка|Жеткізу)\s*:\s*(.+)", line, re.I):
                t.delivery_evidence = line
                t.delivery_page = p["page"]
                if n := re.search(r"(\d+)\s*(?:дн|күн)", m[1], re.I):
                    t.delivery_days = int(n[1])
                continue
            if m := re.match(r"(?:Оплата|Төлем)\s*:\s*(.+)", line, re.I):
                t.payment_evidence = line
                t.payment_page = p["page"]
                if n := re.search(r"(\d+)\s*(?:дн|күн)", m[1], re.I):
                    t.payment_days = int(n[1])
                continue
            if m := re.match(LABELS["name"] + r"\s*:\s*(.+)", line, re.I):
                current = LineItem(name=m[1], page=p["page"], evidence=line, unit="")
                t.items.append(current)
                continue
            if current:
                if m := re.match(LABELS["quantity"] + r"\s*:\s*(.+)", line, re.I):
                    current.quantity = number(m[1])
                    current.evidence += "\n" + line
                    continue
                if m := re.match(LABELS["unit"] + r"\s*:\s*(.+)", line, re.I):
                    current.unit = m[1]
                    continue
                for key in ATTR_NAMES:
                    if m := re.match(LABELS[key] + r"\s*:\s*(.+)", line, re.I):
                        current.requirements.append(
                            Requirement(
                                key=key,
                                label=ATTR_NAMES[key],
                                value=m[1],
                                page=p["page"],
                                evidence=line,
                            )
                        )
                        break
                else:
                    if re.search(
                        r"обязан|требуется|не допуска|только|обязательно|міндетті",
                        line,
                        re.I,
                    ):
                        t.constraints.append(
                            Requirement(
                                key="condition",
                                label="Дополнительное условие",
                                value=line,
                                page=p["page"],
                                evidence=line,
                            )
                        )
        # Dedupe paragraph/table duplication, not repeated rows within actual tables.
        page_text_items = list(t.items[page_start:])
        for table in p.get("tables", []):
            if not table or not table[0]:
                continue
            headers = [str(h or "").lower() for h in table[0]]
            ni = next(
                (
                    i
                    for i, h in enumerate(headers)
                    if re.search("наименование|товар|атауы", h)
                ),
                None,
            )
            qi = next(
                (i for i, h in enumerate(headers) if re.search("количество|саны", h)),
                None,
            )
            ui = next(
                (
                    i
                    for i, h in enumerate(headers)
                    if re.search("единица|ед\\.|өлшем", h)
                ),
                None,
            )
            if ni is None:
                continue
            for row in table[1:]:
                if len(row) <= ni or not row[ni]:
                    continue
                evidence = " | ".join(str(c or "") for c in row)
                item = LineItem(
                    name=str(row[ni]),
                    quantity=(
                        number(str(row[qi]))
                        if qi is not None and len(row) > qi
                        else None
                    ),
                    unit=(
                        str(row[ui])
                        if ui is not None and len(row) > ui and row[ui]
                        else ""
                    ),
                    page=p["page"],
                    evidence=evidence,
                )
                if any(
                    i.name == item.name and i.quantity == item.quantity
                    for i in page_text_items
                ):
                    continue
                for j, h in enumerate(headers):
                    for key in ATTR_NAMES:
                        if re.search(LABELS[key], h, re.I) and j < len(row) and row[j]:
                            item.requirements.append(
                                Requirement(
                                    key=key,
                                    label=ATTR_NAMES[key],
                                    value=str(row[j]),
                                    page=p["page"],
                                    evidence=evidence,
                                )
                            )
                t.items.append(item)
    if not t.items:
        t.warnings.append(
            "Не удалось уверенно выделить товары. Добавьте позиции вручную или повторите извлечение с Gemini."
        )
    if t.budget is None:
        t.warnings.append("Бюджет не указан или не определён.")
    if not t.payment_evidence:
        t.warnings.append("Условия оплаты не определены.")
    return t
