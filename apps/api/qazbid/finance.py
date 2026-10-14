"""Pure Decimal engine. Tax is a user assumption, never a statement of tax law."""

from decimal import Decimal, ROUND_HALF_UP
from .schemas import Scenario

D = Decimal


def money(value):
    return (
        str(value.quantize(D(".01"), rounding=ROUND_HALF_UP))
        if value is not None
        else None
    )


def calculate(lines: list[dict], s: Scenario) -> dict:
    inventory = D(0)
    purchase = D(0)
    missing_total = D(0)
    known = True
    warnings = []
    details = []
    for i, source in enumerate(lines):
        row = {**source, **s.line_overrides.get(str(i), {})}
        if row.get("quantity") is None:
            known = False
            warnings.append(f"{row['name']}: не указано требуемое количество")
            details.append({**source, "missing": None, "economic_cost": None})
            continue
        q = D(str(row["quantity"]))
        a = min(q, D(str(row.get("available") or 0)))
        missing = max(D(0), q - a)
        acq = row.get("acquisition_cost")
        sup = row.get("supplier_cost")
        missing_total += missing
        stock_cost = a * D(str(acq)) if acq is not None else None
        buy_cost = missing * D(str(sup)) if sup is not None else None
        if a and acq is None:
            known = False
            warnings.append(f"{row['name']}: неизвестна стоимость имеющегося запаса")
        if missing and sup is None:
            known = False
            warnings.append(f"{row['name']}: неизвестна цена дозакупки")
        if missing:
            warnings.append(f"{row['name']}: требуется дозакупка {missing} ед.")
            if not row.get("supplier_confirmed"):
                warnings.append(f"{row['name']}: наличие у поставщика не подтверждено")
        inventory += stock_cost or D(0)
        purchase += buy_cost or D(0)
        details.append(
            {
                "name": row["name"],
                "required": str(q),
                "available": str(a),
                "missing": str(missing),
                "acquisition_cost": str(acq) if acq is not None else None,
                "supplier_cost": str(sup) if sup is not None else None,
                "inventory_cost": money(stock_cost if a else D(0)),
                "purchase_cost": money(buy_cost if missing else D(0)),
                "economic_cost": (
                    money((stock_cost or D(0)) + (buy_cost or D(0)))
                    if (not a or acq is not None) and (not missing or sup is not None)
                    else None
                ),
            }
        )
    fixed = s.delivery + s.packaging + s.other
    tax = s.offer_price * s.tax_rate / D(100)
    advance = s.offer_price * s.advance_rate / D(100)
    initial = max(D(0), purchase + fixed + tax - advance)
    financing = initial * s.annual_financing_rate / D(100) * D(s.payment_days) / D(365)
    base = inventory + purchase + fixed + financing
    total = base + tax
    profit = s.offer_price - total
    margin = profit / s.offer_price * 100 if s.offer_price else None
    incremental = max(D(0), initial + financing)
    if known:
        if profit < 0:
            warnings.append("Отрицательная расчётная прибыль")
        elif margin is not None and margin < 5:
            warnings.append("Расчётная маржа ниже 5%")
        if incremental > s.cash_available:
            warnings.append("Недостаточно доступных денег для исполнения")
    if s.delivery > s.offer_price * D(".15"):
        warnings.append("Доставка превышает 15% цены предложения")
    # Financing depends on price only through tax reserve and advance. Solve piecewise.
    f = s.annual_financing_rate / D(100) * D(s.payment_days) / D(365)
    t = s.tax_rate / D(100)
    adv = s.advance_rate / D(100)
    c = inventory + purchase + fixed

    def threshold(m):
        denom = 1 - t - m - f * (t - adv)
        candidate = (c + f * (purchase + fixed)) / denom if denom > 0 else None
        if candidate is not None and purchase + fixed + candidate * (t - adv) < 0:
            candidate = c / (1 - t - m)
        return candidate

    breakeven = threshold(D(0))
    target = threshold(s.target_margin / D(100))
    return {
        "complete": known,
        "revenue": money(s.offer_price),
        "inventory_cost": money(inventory) if known else None,
        "purchase_cost": money(purchase) if known else None,
        "delivery": money(s.delivery),
        "packaging": money(s.packaging),
        "other": money(s.other),
        "tax": money(tax),
        "financing_cost": money(financing) if known else None,
        "total_cost": money(total) if known else None,
        "profit": money(profit) if known else None,
        "margin": money(margin) if known else None,
        "break_even": money(breakeven) if known else None,
        "target_price": money(target) if known else None,
        "incremental_cash": money(incremental) if known else None,
        "cash_gap": money(max(D(0), incremental - s.cash_available)) if known else None,
        "missing_units": str(missing_total),
        "lines": details,
        "warnings": warnings,
        "cash_flow": [
            {
                "day": 0,
                "label": "Закупка и резервы",
                "flow": (
                    money(advance - purchase - fixed - tax - financing)
                    if known
                    else None
                ),
                "balance": (
                    money(
                        s.cash_available + advance - purchase - fixed - tax - financing
                    )
                    if known
                    else None
                ),
            },
            {
                "day": s.delivery_days,
                "label": "Поставка",
                "flow": "0.00",
                "balance": (
                    money(
                        s.cash_available + advance - purchase - fixed - tax - financing
                    )
                    if known
                    else None
                ),
            },
            {
                "day": max(s.delivery_days, s.payment_days),
                "label": "Оплата заказчика",
                "flow": money(s.offer_price - advance),
                "balance": (
                    money(
                        s.cash_available
                        + s.offer_price
                        - purchase
                        - fixed
                        - tax
                        - financing
                    )
                    if known
                    else None
                ),
            },
        ],
        "formula": "Прибыль = предложение − стоимость запасов − дозакупка − доставка − упаковка − прочие расходы − налоговый резерв − финансирование",
    }
