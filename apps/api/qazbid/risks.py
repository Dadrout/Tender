from decimal import Decimal
from .schemas import Tender, Scenario


def assess(
    tender: Tender, matches: dict, financial: dict, s: Scenario
) -> tuple[list[dict], str]:
    risks = []

    def add(
        title,
        group,
        severity,
        description,
        action,
        page=None,
        evidence=None,
        method="deterministic",
    ):
        risks.append(
            {
                "id": str(len(risks) + 1),
                "title": title,
                "group": group,
                "severity": severity,
                "description": description,
                "consequence": {
                    "critical": "Участие при текущих данных может привести к неисполнению или убытку.",
                    "high": "Требуется подтверждение до подачи предложения.",
                    "medium": "Может изменить сроки или расходы.",
                }.get(severity, "Уточнение условий исполнения."),
                "action": action,
                "page": page,
                "evidence": evidence,
                "method": method,
            }
        )

    selected = [m for m in matches["matrix"] if m["selected"]]
    conflicts = [m for m in selected if m["status"] == "CONFLICT" and m["critical"]]
    for m in conflicts:
        add(
            f"Несоответствие: {m['property']}",
            "technical",
            "critical",
            f"{m['item']}: требуется {m['required']}, в каталоге {m['actual']}.",
            "Выбрать товар с подтверждёнными характеристиками",
            m["page"],
            m["requirement"],
        )
    for m in selected:
        if m["status"] == "UNKNOWN":
            add(
                f"Не подтверждено: {m['property']}",
                "documentation" if "Документ" in m["property"] else "technical",
                "high",
                f"{m['item']}: отсутствует достаточное подтверждение.",
                m["action"],
                m["page"],
                m["requirement"],
            )
    for i, row in enumerate(matches["selected"]):
        p = row["product"]
        missing = financial["lines"][i].get("missing")
        if missing is not None and Decimal(missing) > 0:
            add(
                "Недостаточный остаток",
                "inventory",
                "high",
                f"{row['item']}: не хватает {missing} ед.",
                "Получить подтверждение цены, наличия и срока дозакупки",
                tender.items[i].page,
                tender.items[i].evidence,
            )
            if not p or not p.get("supplier_confirmed"):
                add(
                    "Поставщик не подтвердил наличие",
                    "inventory",
                    "high",
                    "Дозакупка пока является предположением.",
                    "Получить письменное подтверждение поставщика",
                )
            if (
                p
                and p.get("lead_days") is not None
                and tender.delivery_days is not None
                and p["lead_days"] > tender.delivery_days
            ):
                add(
                    "Срок дозакупки превышает срок поставки",
                    "delivery",
                    "critical",
                    f"Поставщик: {p['lead_days']} дней; требование: {tender.delivery_days} дней.",
                    "Согласовать другой источник или отказаться от текущего сценария",
                    tender.delivery_page,
                    tender.delivery_evidence,
                )
            elif not p or p.get("lead_days") is None:
                add(
                    "Неизвестен срок дозакупки",
                    "delivery",
                    "high",
                    "Срок поставщика отсутствует.",
                    "Уточнить календарный срок",
                )
    if tender.delivery_days is None:
        add(
            "Срок поставки не определён",
            "delivery",
            "high",
            "Не удалось уверенно определить обязательный срок.",
            "Проверить условия договора",
        )
    elif s.delivery_days > tender.delivery_days:
        add(
            "План поставки нарушает требование",
            "delivery",
            "critical",
            f"План: {s.delivery_days} дней; требование: {tender.delivery_days}.",
            "Изменить план исполнения",
            tender.delivery_page,
            tender.delivery_evidence,
        )
    if not financial["complete"]:
        add(
            "Расчёт себестоимости неполный",
            "financial",
            "high",
            "Количество или стоимость некоторых товаров неизвестны. Прибыль не рассчитана.",
            "Заполнить стоимость запасов и дозакупки",
        )
    elif Decimal(financial["profit"]) < 0:
        add(
            "Отрицательная прибыль",
            "financial",
            "critical",
            f"Расчётный убыток: {financial['profit']} ₸.",
            "Пересмотреть цену и затраты",
        )
    elif financial["margin"] and Decimal(financial["margin"]) < 5:
        add(
            "Низкая маржа",
            "financial",
            "medium",
            f"Маржа: {financial['margin']}%.",
            "Проверить чувствительность к расходам",
        )
    if financial["cash_gap"] and Decimal(financial["cash_gap"]) > 0:
        add(
            "Дефицит денежных средств",
            "cash_flow",
            "high",
            f"Недостаёт {financial['cash_gap']} ₸ с учётом введённого аванса.",
            "Подтвердить источник финансирования",
        )
    if s.line_overrides:
        add(
            "Введены товарные допущения",
            "inventory",
            "high",
            "Количество, остаток или цены сценария заданы пользователем и требуют подтверждения. Документная матрица остаётся отдельной проверкой.",
            "Сверить предположения с фактическими остатками и требованиями",
        )
    if any(i.origin == "manual" for i in tender.items):
        add(
            "Требования исправлены вручную",
            "technical",
            "high",
            "Исходные цитаты сохранены. Изменённые товары и количества являются утверждениями пользователя.",
            "Сверить исправления с первичным документом",
        )
    if tender.payment_days is None:
        add(
            "Условия оплаты не определены",
            "contract",
            "high",
            "Срок оплаты в модели задан пользователем и не подтверждён документом.",
            "Проверить контракт до участия",
        )
    elif tender.payment_days is not None and s.payment_days < tender.payment_days:
        add(
            "Сценарий оплаты оптимистичнее документа",
            "cash_flow",
            "high",
            "Введённый срок оплаты короче указанного в документе.",
            "Обновить предположение об оплате",
            tender.payment_page,
            tender.payment_evidence,
        )
    for item in tender.items:
        for r in item.requirements:
            if r.key == "brand":
                add(
                    "Требование конкретной марки",
                    "restrictive",
                    "medium",
                    "Точная марка может ограничивать выбор альтернатив. Это предварительное наблюдение, не юридический вывод.",
                    "Уточнить допустимость эквивалента у заказчика",
                    r.page,
                    r.evidence,
                    "wording_rule",
                )
    for r in tender.constraints:
        if any(
            word in r.value.lower()
            for word in ["только", "эквивалент", "не допуска", "исключительно"]
        ):
            add(
                "Условие требует отдельной проверки",
                "contract",
                "medium",
                r.value,
                "Проверить смысл условия со специалистом",
                r.page,
                r.evidence,
                "ai_assisted" if r.origin == "ai" else "wording_rule",
            )
    if not tender.items:
        add(
            "Не извлечены позиции",
            "technical",
            "critical",
            "Нет подтверждённого перечня требуемых товаров.",
            "Добавить позиции в разделе проверки документа",
        )
    decision = (
        "NOT_FEASIBLE"
        if any(r["severity"] == "critical" for r in risks)
        else (
            "REQUIRES_ATTENTION"
            if any(r["severity"] in ["high", "medium"] for r in risks)
            else "READY_FOR_REVIEW"
        )
    )
    return risks, decision
