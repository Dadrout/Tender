import re
from decimal import Decimal
from .schemas import Tender, Product

SYNONYMS = {
    "желтый": "желтый",
    "желтая": "желтый",
    "сары": "желтый",
    "белая": "белый",
    "ақ": "белый",
    "черная": "черный",
    "қара": "черный",
    "сталь": "сталь",
    "болат": "сталь",
    "штука": "шт",
    "дана": "шт",
    "штук": "шт",
    "пластик": "пластик",
    "пластмасса": "пластик",
    "эмаль": "эмаль",
    "эмалі": "эмаль",
    "кисть": "кисть",
    "қылқалам": "кисть",
    "ведро": "ведро",
    "шелек": "ведро",
}
UNITS = {
    "мл": ("volume", Decimal(".001")),
    "ml": ("volume", Decimal(".001")),
    "л": ("volume", Decimal(1)),
    "литр": ("volume", Decimal(1)),
    "литров": ("volume", Decimal(1)),
    "l": ("volume", Decimal(1)),
    "мм": ("length", Decimal(".001")),
    "см": ("length", Decimal(".01")),
    "м": ("length", Decimal(1)),
    "mm": ("length", Decimal(".001")),
    "cm": ("length", Decimal(".01")),
    "m": ("length", Decimal(1)),
    "г": ("mass", Decimal(".001")),
    "кг": ("mass", Decimal(1)),
}


def normalized(s):
    text = s.lower().replace("ё", "е").strip()
    return " ".join(SYNONYMS.get(w, w) for w in re.findall(r"[\w]+", text))


def normalize_measure(value):
    text = value.lower().replace(",", ".").strip()
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*([a-zа-я]+)\.?", text)
    if m and m[2] in UNITS:
        category, factor = UNITS[m[2]]
        return category, Decimal(m[1]) * factor
    # Only complete numeric dimension tuples; no loose number search.
    m = re.fullmatch(
        r"((?:\d+(?:\.\d+)?\s*[xх×*]\s*)+\d+(?:\.\d+)?)\s*(мм|см|м|mm|cm|m)", text
    )
    if m:
        cat, f = UNITS[m[2]]
        return cat, tuple(Decimal(v.strip()) * f for v in re.split(r"[xх×*]", m[1]))
    return None


def compare_value(required, actual):
    if actual is None or not str(actual).strip():
        return "UNKNOWN"
    r = normalize_measure(required)
    a = normalize_measure(actual)
    if r and a:
        return "VERIFIED_MATCH" if r == a else "CONFLICT"
    if r and not a:
        return "UNKNOWN"
    return (
        "VERIFIED_MATCH" if normalized(required) == normalized(actual) else "CONFLICT"
    )


def candidate_score(item, product):
    a = set(normalized(item.name).split())
    b = set(normalized(product.name).split())
    overlap = a & b
    if not overlap:
        return 0
    category_words = {
        "эмаль",
        "кисть",
        "ведро",
        "перчатки",
        "краска",
        "цемент",
        "валик",
        "лампа",
        "бумага",
        "мыло",
        "пакеты",
        "швабра",
    }
    ca = a & category_words
    cb = b & category_words
    if ca and (not cb or not ca & cb):
        return -1000
    base = len(overlap) / max(1, len(a | b))
    comparisons = [
        compare_value(r.value, product.attributes.get(r.key)) for r in item.requirements
    ]
    return (
        base
        + comparisons.count("VERIFIED_MATCH") * 0.3
        - comparisons.count("CONFLICT") * 0.4
    )


def match_tender(tender: Tender, products: list[Product]) -> dict:
    matrix = []
    selected = []
    cost_lines = []
    remaining = {i: p.quantity for i, p in enumerate(products)}
    for li, item in enumerate(tender.items):
        candidates = sorted(
            [
                (i, p)
                for i, p in enumerate(products)
                if set(normalized(item.name).split()) & set(normalized(p.name).split())
                and candidate_score(item, p) > -1000
            ],
            key=lambda pair: candidate_score(item, pair[1]),
            reverse=True,
        )[:3]
        reqs = [
            r.model_dump(mode="json") for r in [*item.requirements, *tender.constraints]
        ]
        if not reqs:
            reqs = [
                dict(
                    key="specification",
                    label="Технические характеристики",
                    value="Не удалось определить",
                    page=item.page,
                    evidence=item.evidence,
                    critical=True,
                    origin="document",
                    confidence=0,
                )
            ]
        for rank, (product_index, product) in enumerate(candidates or [(None, None)]):
            inventory_evidence = dict(product.raw) if product else {}
            if product and product.manual_fields:
                inventory_evidence["Ручное изменение"] = (
                    f"{product.edited_at}: " + "; ".join(product.manual_fields)
                )
                inventory_evidence["Текущие характеристики пользователя"] = str(
                    product.attributes
                )
            for req in reqs:
                actual = product.attributes.get(req["key"]) if product else None
                status = compare_value(req["value"], actual)
                if req["origin"] == "manual" and status == "VERIFIED_MATCH":
                    status = "UNKNOWN"
                explanation = {
                    "VERIFIED_MATCH": "Значения требования и каталога совпадают. Проверьте актуальность сведений каталога.",
                    "CONFLICT": "Значение в каталоге противоречит требованию.",
                    "UNKNOWN": "Недостаточно сведений для подтверждения соответствия.",
                }[status]
                matrix.append(
                    {
                        "id": f'{li}-{rank}-{req["key"]}-{len(matrix)}',
                        "line": li,
                        "item": item.name,
                        "requirement": req["evidence"],
                        "property": req["label"],
                        "required": req["value"],
                        "actual": actual,
                        "page": req["page"],
                        "critical": req["critical"],
                        "origin": req["origin"],
                        "confidence": req["confidence"],
                        "product_name": product.name if product else None,
                        "sku": product.sku if product else None,
                        "product_id": product.id if product else None,
                        "row": product.row if product else None,
                        "inventory_evidence": inventory_evidence,
                        "status": status,
                        "selected": rank == 0,
                        "explanation": explanation,
                        "action": (
                            "Проверить первичные документы"
                            if status == "VERIFIED_MATCH"
                            else (
                                "Уточнить у поставщика / выбрать подходящий товар"
                                if status == "CONFLICT"
                                else "Добавить подтверждающие характеристики или документы"
                            )
                        ),
                    }
                )
            q = item.quantity
            avail = (
                (remaining[product_index] if rank == 0 else product.quantity)
                if product
                else Decimal(0)
            )
            same_unit = bool(
                product
                and item.unit
                and product.unit
                and normalized(item.unit) == normalized(product.unit)
            )
            status = (
                "UNKNOWN"
                if q is None or not same_unit
                else "VERIFIED_MATCH" if avail >= q else "PARTIAL_MATCH"
            )
            if item.origin == "manual" and status == "VERIFIED_MATCH":
                status = "UNKNOWN"
            matrix.append(
                {
                    "id": f"{li}-{rank}-quantity",
                    "line": li,
                    "item": item.name,
                    "requirement": item.evidence,
                    "property": "Количество",
                    "required": str(q) if q is not None else None,
                    "actual": str(avail),
                    "page": item.page,
                    "critical": True,
                    "origin": item.origin,
                    "confidence": 0 if item.origin == "manual" else 1,
                    "product_name": product.name if product else None,
                    "sku": product.sku if product else None,
                    "product_id": product.id if product else None,
                    "row": product.row if product else None,
                    "inventory_evidence": inventory_evidence,
                    "status": status,
                    "selected": rank == 0,
                    "explanation": (
                        "Остатка достаточно"
                        if status == "VERIFIED_MATCH"
                        else (
                            "Единицы измерения отсутствуют или отличаются; ручной пересчёт требует подтверждения."
                            if not same_unit
                            else (
                                "Количество исправлено пользователем; исходная цитата сохранена."
                                if item.origin == "manual"
                                else (
                                    "Не определено количество"
                                    if q is None
                                    else "Нужна дозакупка. Доступность и цену подтвердите у поставщика."
                                )
                            )
                        )
                    ),
                    "action": (
                        "Подтвердить остаток"
                        if status == "VERIFIED_MATCH"
                        else "Согласовать дозакупку"
                    ),
                }
            )
        pair = candidates[0] if candidates else None
        product = pair[1] if pair else None
        same_unit = bool(
            product
            and item.unit
            and product.unit
            and normalized(item.unit) == normalized(product.unit)
        )
        available = remaining[pair[0]] if pair else Decimal(0)
        missing = (
            max(Decimal(0), item.quantity - available)
            if item.quantity is not None
            else None
        )
        selected.append(
            {
                "line": li,
                "item": item.name,
                "product": product.model_dump(mode="json") if product else None,
                "required": str(item.quantity) if item.quantity is not None else None,
                "available": str(available),
                "missing": str(missing) if missing is not None else None,
            }
        )
        if pair and item.quantity is not None:
            remaining[pair[0]] = max(Decimal(0), available - item.quantity)
        cost_lines.append(
            {
                "name": item.name,
                "quantity": (
                    str(item.quantity)
                    if item.quantity is not None and same_unit
                    else None
                ),
                "available": str(available),
                "acquisition_cost": (
                    str(product.acquisition_cost)
                    if product and product.acquisition_cost is not None
                    else None
                ),
                "supplier_cost": (
                    str(product.supplier_cost)
                    if product and product.supplier_cost is not None
                    else None
                ),
                "supplier_confirmed": product.supplier_confirmed if product else False,
            }
        )
    return {
        "matrix": matrix,
        "selected": selected,
        "cost_lines": cost_lines,
        "counts": {
            s: sum(m["status"] == s and m["selected"] for m in matrix)
            for s in ["VERIFIED_MATCH", "CONFLICT", "UNKNOWN", "PARTIAL_MATCH"]
        },
    }
