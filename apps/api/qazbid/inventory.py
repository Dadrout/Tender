import re, zipfile
from decimal import Decimal, InvalidOperation
from pathlib import Path
import pandas as pd
from .schemas import Product

ALIASES = {
    "name": ["наименование", "товар", "название", "атауы", "тауар", "өнім"],
    "sku": ["артикул", "sku", "код", "коды"],
    "quantity": ["количество", "остаток", "саны", "қалдық"],
    "acquisition_cost": [
        "закупочная цена",
        "цена закупки",
        "себестоимость",
        "сатып алу бағасы",
        "цена",
    ],
    "supplier_cost": ["цена поставщика", "цена дозакупки", "жеткізуші бағасы"],
    "supplier": ["поставщик", "жеткізуші"],
    "unit": ["единица измерения", "единица", "өлшем бірлігі"],
    "lead_days": ["срок поставки", "срок поставки дней", "жеткізу мерзімі"],
    "supplier_confirmed": ["наличие поставщика", "наличие подтверждено", "қолжетімді"],
    "volume": ["объем", "объём", "фасовка", "көлемі"],
    "dimensions": ["размер", "размеры", "габариты", "өлшемі"],
    "color": ["цвет", "түсі"],
    "material": ["материал"],
    "brand": ["бренд", "производитель", "марка", "өндіруші"],
    "standard": ["стандарт", "гост", "ст рк"],
    "certificate": ["сертификат", "документы", "құжат"],
    "characteristics": ["характеристики", "сипаттамалары"],
}


def read_frame(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".xlsx":
        try:
            with zipfile.ZipFile(path) as z:
                if (
                    sum(i.file_size for i in z.infolist()) > 60 * 1024 * 1024
                    or len(z.infolist()) > 2000
                ):
                    raise ValueError("Слишком большой распакованный Excel")
                if any(i.flag_bits & 1 for i in z.infolist()):
                    raise ValueError("Зашифрованный Excel не поддерживается")
        except zipfile.BadZipFile as e:
            raise ValueError("Некорректный XLSX") from e
    try:
        if path.suffix.lower() == ".csv":
            try:
                frame = pd.read_csv(
                    path,
                    sep=None,
                    engine="python",
                    encoding="utf-8-sig",
                    dtype=str,
                    nrows=5001,
                )
            except UnicodeDecodeError:
                frame = pd.read_csv(
                    path,
                    sep=None,
                    engine="python",
                    encoding="cp1251",
                    dtype=str,
                    nrows=5001,
                )
        else:
            frame = pd.read_excel(
                path,
                dtype=str,
                nrows=5001,
                engine="xlrd" if path.suffix.lower() == ".xls" else "openpyxl",
            )
    except Exception as e:
        raise ValueError(
            "Не удалось прочитать таблицу. Проверьте формат и первую строку заголовков."
        ) from e
    if len(frame) > 5000 or len(frame.columns) > 100:
        raise ValueError("Лимит каталога: 5000 строк и 100 столбцов")
    return frame.fillna("")


def suggest_mapping(headers: list[str]) -> dict:
    return {
        key: h
        for h in headers
        for key, aliases in ALIASES.items()
        if re.sub(r"\s+", " ", h.lower().strip()) in aliases
    }


def decimal_cell(value: str, field: str, row: int):
    if not value.strip():
        return None
    try:
        d = Decimal(re.sub(r"[\s₸]", "", value).replace(",", "."))
        if not d.is_finite() or d < 0:
            raise InvalidOperation
        return d
    except InvalidOperation:
        raise ValueError(
            f"Строка {row}: поле «{field}» должно содержать неотрицательное число; исходное значение «{value}»"
        )


def import_inventory(path: Path, mapping: dict | None = None) -> list[Product]:
    frame = read_frame(path)
    mapping = mapping or suggest_mapping(list(frame.columns))
    if "name" not in mapping:
        raise ValueError(
            "Не найден столбец наименования. Укажите соответствие столбцов."
        )
    if set(mapping.values()) - set(frame.columns):
        raise ValueError("Указан отсутствующий столбец")
    products = []
    for idx, row in frame.iterrows():
        raw = {str(k): str(v) for k, v in row.items()}
        rownum = int(idx) + 2

        def v(k):
            return raw.get(mapping.get(k, ""), "").strip()

        if not v("name"):
            continue
        quantity = decimal_cell(v("quantity"), "Количество", rownum)
        if quantity is None:
            raise ValueError(
                f"Строка {rownum}: отсутствует остаток. Укажите количество явно."
            )
        lead = decimal_cell(v("lead_days"), "Срок поставки", rownum)
        if lead is not None and lead != lead.to_integral_value():
            raise ValueError(
                f"Строка {rownum}: срок поставки должен быть целым числом дней"
            )
        attrs = {
            k: v(k)
            for k in [
                "volume",
                "dimensions",
                "color",
                "material",
                "brand",
                "standard",
                "certificate",
            ]
            if v(k)
        }
        # Explicit key:value attributes only; preserve everything else in raw.
        for part in v("characteristics").split(";"):
            if ":" not in part:
                continue
            key, val = part.split(":", 1)
            keys = suggest_mapping([key.strip()])
            if keys and val.strip():
                attrs[next(iter(keys))] = val.strip()
        products.append(
            Product(
                name=v("name"),
                sku=v("sku"),
                quantity=quantity,
                unit=v("unit"),
                acquisition_cost=decimal_cell(
                    v("acquisition_cost"), "Закупочная цена", rownum
                ),
                supplier_cost=decimal_cell(
                    v("supplier_cost"), "Цена поставщика", rownum
                ),
                supplier=v("supplier") or None,
                supplier_confirmed=v("supplier_confirmed").lower()
                in ["да", "yes", "true", "1", "иә"],
                lead_days=int(lead) if lead is not None else None,
                attributes=attrs,
                raw=raw,
                row=rownum,
            )
        )
    if not products:
        raise ValueError("В каталоге нет товаров")
    return products
