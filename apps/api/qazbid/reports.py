from pathlib import Path
from html import escape
from datetime import datetime, timezone
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)

FONT = Path(__file__).parent / "assets"
pdfmetrics.registerFont(TTFont("QazSans", str(FONT / "NotoSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("QazBold", str(FONT / "NotoSans-Bold.ttf")))
DECISIONS = {
    "ru": {
        "READY_FOR_REVIEW": "Готов к итоговой проверке",
        "REQUIRES_ATTENTION": "Требует внимания",
        "NOT_FEASIBLE": "Невыполним при текущих допущениях",
    },
    "kk": {
        "READY_FOR_REVIEW": "Қорытынды тексеруге дайын",
        "REQUIRES_ATTENTION": "Назар аудару қажет",
        "NOT_FEASIBLE": "Ағымдағы болжамдарда орындалмайды",
    },
}


def generate_pdf(data: dict, path: Path, lang="ru"):
    kk = lang == "kk"
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="QBody",
            fontName="QazSans",
            fontSize=9,
            leading=14,
            textColor=colors.HexColor("#243247"),
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="QTitle",
            fontName="QazBold",
            fontSize=24,
            leading=30,
            textColor=colors.HexColor("#17263c"),
            spaceAfter=16,
        )
    )
    styles.add(
        ParagraphStyle(
            name="QHeading",
            fontName="QazBold",
            fontSize=14,
            leading=20,
            textColor=colors.HexColor("#2453d4"),
            spaceBefore=12,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="QSmall",
            fontName="QazSans",
            fontSize=7,
            leading=10,
            textColor=colors.HexColor("#536178"),
        )
    )
    story = []

    def p(text, style="QBody"):
        return Paragraph(
            escape(str(text or ("Көрсетілмеген" if kk else "Не указано"))).replace(
                "\n", "<br/>"
            ),
            styles[style],
        )

    def heading(ru, kz):
        story.append(p(kz if kk else ru, "QHeading"))

    def table(rows, widths, dense=False):
        tab = Table(
            [[p(c, "QSmall") for c in row] for row in rows],
            colWidths=widths,
            repeatRows=1,
            hAlign="LEFT",
        )
        tab.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf2fb")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.HexColor("#c9d5ea")),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.3, colors.HexColor("#e5e9ef")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 7),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 4 if dense else 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4 if dense else 7),
                ]
            )
        )
        story.append(tab)

    t = data["tender"]
    f = data["financial"]
    s = data["scenario"]
    story.append(p("QazBid AI", "QTitle"))
    story.append(
        p("Тендерді талдау есебі" if kk else "Отчёт об анализе тендера", "QHeading")
    )
    story.append(p(t["title"], "QTitle"))
    stamp = (
        datetime.now(timezone.utc)
        .astimezone(__import__("zoneinfo").ZoneInfo("Asia/Almaty"))
        .strftime("%d.%m.%Y %H:%M UTC+5")
    )
    story.append(p(("Жасалған: " if kk else "Сформирован: ") + stamp))
    story.append(
        p(
            ("Өңдеу режимі: " if kk else "Режим обработки: ")
            + (
                "Gemini + детерминированные проверки"
                if data["mode"] == "gemini"
                else "Локальная детерминированная обработка"
            )
        )
    )
    if t.get("synthetic"):
        story.append(
            p("СИНТЕТИКАЛЫҚ ОҚУ МЫСАЛЫ" if kk else "СИНТЕТИЧЕСКИЙ УЧЕБНЫЙ ПРИМЕР")
        )
    heading("1. Решение и краткое резюме", "1. Шешім және қысқаша қорытынды")
    story.append(p(DECISIONS["kk" if kk else "ru"][data["decision"]], "QHeading"))
    story.append(
        p(
            (
                "Сыни талаптар толық расталғанша қатысу туралы шешімді маман тексереді."
                if kk
                else "Результат поддерживает решение предпринимателя. До участия необходимо проверить все критические требования и первичные документы."
            )
        )
    )
    table(
        [
            ["Показатель" if not kk else "Көрсеткіш", "Значение" if not kk else "Мәні"],
            [
                "Цена предложения / Ұсыныс бағасы",
                (f["revenue"] or "Не задана / Берілмеген") + " ₸",
            ],
            ["Прибыль / Пайда", (f["profit"] or "Не рассчитана / Есептелмеген") + " ₸"],
            ["Маржа / Маржа", (f["margin"] or "-") + "%"],
            [
                "Дополнительные деньги / Қосымша қаражат",
                (f["incremental_cash"] or "-") + " ₸",
            ],
        ],
        [270, 240],
    )
    heading(
        "2. Идентификация и объём закупки", "2. Сатып алуды сәйкестендіру және көлемі"
    )
    for key, label in [
        ("identifier", "Номер / Нөмірі"),
        ("buyer", "Заказчик / Тапсырыс беруші"),
        ("region", "Регион / Өңір"),
        ("method", "Способ / Тәсіл"),
        ("budget", "Бюджет / Бюджеті"),
        ("deadline", "Срок подачи / Өтінім мерзімі"),
    ]:
        story.append(p(label + ": " + str(t.get(key) or "Не указано / Көрсетілмеген")))
    for line in t["items"]:
        story.append(
            p(
                f"{line['name']} — {line.get('quantity') or '?'} {line['unit']}; PDF, стр. {line['page']}"
            )
        )
    story.append(PageBreak())
    heading(
        "3. Матрица требований и совместимость", "3. Талаптар матрицасы және сәйкестік"
    )
    story.append(
        p(
            "Сведения каталога являются утверждениями владельца. Совпадение значения не заменяет проверку сертификата. Альтернативы помечены отдельно."
            if not kk
            else "Каталог деректері иесінің мәлімдемесі. Мәндердің сәйкестігі сертификатты тексеруді алмастырмайды."
        )
    )
    rows = [
        [
            "Требование / Талап",
            "Каталог / Каталог",
            "Статус / Күй",
            "Источник / Дереккөз",
        ]
    ]
    for m in data["matches"]["matrix"]:
        if not m["selected"] and m["status"] != "CONFLICT":
            continue
        rows.append(
            [
                f"{m['item']}\n{m['property']}: {m['required'] or '?'}",
                f"{m['product_name'] or '-'}\n{m['actual'] or 'Нет данных'}\n{'Основной кандидат' if m['selected'] else 'Альтернатива'}",
                (
                    {
                        "VERIFIED_MATCH": "Сәйкес" if kk else "Совпадает",
                        "CONFLICT": "Қайшылық" if kk else "Конфликт",
                        "PARTIAL_MATCH": "Ішінара" if kk else "Частично",
                        "UNKNOWN": "Дерек жоқ" if kk else "Нет сведений",
                    }[m["status"]]
                ),
                f"PDF: {m['page']}\nXLSX: {m['row'] or '-'}\n{m['requirement']}"
                + (
                    ("\nҚолмен түзетілген" if kk else "\nРучное утверждение")
                    if m.get("origin") == "manual"
                    else ""
                ),
            ]
        )
    table(rows, [153, 151, 91, 115], dense=True)
    story.append(
        p(
            (
                "Показаны основные кандидаты и конфликты альтернатив. Полная матрица всех кандидатов доступна в экспорте XLSX/CSV."
                if not kk
                else "Негізгі кандидаттар мен балама қайшылықтар көрсетілген. Барлық кандидаттың толық матрицасы XLSX/CSV экспортында қолжетімді."
            ),
            "QSmall",
        )
    )
    story.append(PageBreak())
    heading("4. Финансы и недостающие товары", "4. Қаржы және жетіспейтін тауарлар")
    rows = [
        [
            "Товар / Тауар",
            "Нужно / Қажет",
            "Запас / Қор",
            "Дозакупка / Қосымша",
            "Стоимость / Құны",
        ]
    ]
    for row in f["lines"]:
        rows.append(
            [
                row["name"],
                row.get("required") or "?",
                row.get("available") or "?",
                row.get("missing") or "?",
                row.get("economic_cost") or "Неизвестна",
            ]
        )
    table(rows, [170, 65, 65, 90, 120])
    heading("Прозрачный расчёт", "Ашық есептеу")
    story.append(p(f["formula"]))
    labels = {
        "inventory_cost": "Стоимость запасов / Қор құны",
        "purchase_cost": "Дозакупка / Қосымша сатып алу",
        "delivery": "Доставка / Жеткізу",
        "packaging": "Упаковка / Қаптама",
        "other": "Прочие расходы / Өзге шығындар",
        "tax": "Налоговый резерв / Салық резерві",
        "financing_cost": "Финансирование / Қаржыландыру",
        "total_cost": "Итого затраты / Жалпы шығын",
        "break_even": "Безубыточная цена / Залалсыз баға",
        "target_price": "Цена целевой маржи / Мақсатты маржа бағасы",
        "cash_gap": "Дефицит денег / Қаражат тапшылығы",
    }
    table(
        [["Показатель / Көрсеткіш", "KZT"]]
        + [
            [label, f.get(key) or "Не рассчитано / Есептелмеген"]
            for key, label in labels.items()
        ],
        [330, 180],
    )
    heading("5. Денежный поток и допущения", "5. Ақша ағыны және болжамдар")
    story.append(
        p(
            "Историческая стоимость запаса влияет на прибыль, но не является новой выплатой. В модели налог резервируется при закупке; аванс предполагается доступным в день 0. Финансирование: простые проценты на дополнительную потребность до оплаты."
            if not kk
            else "Қордың тарихи құны пайдаға әсер етеді, бірақ жаңа төлем емес. Салық сатып алу кезінде резервтеледі; аванс 0-күні қолжетімді деп болжанады."
        )
    )
    table(
        [["День / Күн", "Событие / Оқиға", "Поток / Ағын", "Остаток / Қалдық"]]
        + [
            [str(x["day"]), x["label"], x["flow"] or "-", x["balance"] or "-"]
            for x in f["cash_flow"]
        ],
        [55, 205, 125, 125],
    )
    assumptions = {
        "offer_price": ("Цена предложения", "Ұсыныс бағасы"),
        "delivery": ("Доставка", "Жеткізу"),
        "packaging": ("Упаковка", "Қаптама"),
        "other": ("Прочие расходы", "Өзге шығындар"),
        "tax_rate": ("Налоговый резерв, %", "Салық резерві, %"),
        "target_margin": ("Целевая маржа, %", "Мақсатты маржа, %"),
        "annual_financing_rate": (
            "Годовая ставка финансирования, %",
            "Жылдық қаржыландыру, %",
        ),
        "payment_days": ("Срок оплаты, дней", "Төлем мерзімі, күн"),
        "advance_rate": ("Аванс, %", "Аванс, %"),
        "cash_available": ("Доступные деньги", "Қолжетімді қаражат"),
        "delivery_days": ("План поставки, дней", "Жеткізу жоспары, күн"),
    }
    story.append(
        p(
            "; ".join(
                f"{assumptions[k][int(kk)]}: {v}"
                for k, v in s.items()
                if k in assumptions
            )
        )
    )
    if s.get("line_overrides"):
        story.append(
            p(
                "Товарные параметры сценария изменены пользователем."
                if not kk
                else "Сценарий тауар параметрлерін пайдаланушы өзгертті."
            )
        )
    for w in f["warnings"]:
        story.append(p(w))
    story.append(PageBreak())
    heading("6. Риски и необходимые действия", "6. Тәуекелдер және қажетті әрекеттер")
    for r in data["risks"]:
        story.append(
            KeepTogether(
                [
                    p(
                        (
                            {
                                "critical": "Сыни" if kk else "Критичный",
                                "high": "Жоғары" if kk else "Высокий",
                                "medium": "Орташа" if kk else "Умеренный",
                            }.get(r["severity"], r["severity"])
                        )
                        + " · "
                        + r["title"],
                        "QHeading",
                    ),
                    p(r["description"]),
                    p("Последствие / Салдары: " + r["consequence"]),
                    p("Действие / Әрекет: " + r["action"]),
                    p(
                        f"Метод: {r['method']}. Источник: "
                        + (
                            f"PDF, стр. {r['page']}: {r['evidence']}"
                            if r["page"]
                            else "Расчёт / введённые предположения"
                        ),
                        "QSmall",
                    ),
                ]
            )
        )
    heading(
        "7. Источники, допущения и ограничения",
        "7. Дереккөздер, болжамдар және шектеулер",
    )
    story.append(
        p(
            "Источники: загруженный PDF с постраничными цитатами; импортированный каталог с номерами исходных строк; введённые финансовые допущения. Ручные исправления помечаются в приложении и сохраняются в журнале. Данные могут требовать подтверждения у заказчика и поставщика."
            if not kk
            else "Дереккөздер: бет нөмірлері бар PDF; жол нөмірлері бар каталог; енгізілген қаржылық болжамдар. Қолмен түзетулер журналда сақталады."
        )
    )
    story.append(
        p(
            "Не является юридическим заключением. Не гарантирует допуск, победу или прибыль. Налоговая ставка — предположение пользователя, а не универсальное правило законодательства Казахстана."
            if not kk
            else "Заңдық қорытынды емес. Қатысуға рұқсатты, жеңісті немесе пайданы кепілдемейді. Салық мөлшерлемесі пайдаланушының болжамы."
        )
    )

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#dce3ef"))
        canvas.line(42, 38, 553, 38)
        canvas.setFont("QazSans", 8)
        canvas.setFillColor(colors.HexColor("#637088"))
        canvas.drawString(42, 25, "QazBid AI · " + data["id"][:12])
        canvas.drawRightString(553, 25, str(doc.page))
        canvas.restoreState()

    path.parent.mkdir(parents=True, exist_ok=True)
    SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=40,
        bottomMargin=50,
        title="QazBid AI Analysis",
        author="QazBid AI",
    ).build(story, onFirstPage=footer, onLaterPages=footer)
