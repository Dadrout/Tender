"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft,
  Download,
  FileSearch,
  Check,
  AlertTriangle,
  HelpCircle,
  Boxes,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  LoaderCircle,
  SlidersHorizontal,
  FileText,
  ExternalLink,
  Search,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { Analysis, Tender, MatrixRow, Scenario, Status } from "@/lib/types";
import { api, kzt, date } from "@/lib/api";
import { useLocale } from "@/lib/context";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import {
  PageHeading,
  ErrorState,
  Loading,
  StatusBadge,
  DecisionBadge,
  FinanceMetrics,
  Metric,
} from "./shared";

export function AnalysisWorkspace({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const [tab, setTab] = useState("summary");
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<MatrixRow | null>(null);
  const q = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api<Analysis>("/analyses/" + id),
  });
  const rerun = useMutation({
    mutationFn: () =>
      api<Analysis>("/analyses/" + id + "/run", { method: "POST" }),
    onSuccess: (a) => {
      client.setQueryData(["analysis", id], a);
      client.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const a = q.data;
  if (a.state === "review" || editing)
    return (
      <Review
        a={a}
        onFinish={() => {
          setEditing(false);
          q.refetch();
        }}
        onCancel={editing ? () => setEditing(false) : undefined}
      />
    );
  const tabs = [
    ["summary", t("Обзор и решение", "Шолу және шешім")],
    ["matrix", t("Матрица требований", "Талаптар матрицасы")],
    ["finance", t("Симулятор прибыли", "Пайда симуляторы")],
    ["risks", t("Риски", "Тәуекелдер")],
    ["details", t("Данные тендера", "Тендер деректері")],
  ];
  return (
    <>
      <Link className="back-link" href="/dashboard">
        <ArrowLeft size={15} />
        {t("Все анализы", "Барлық талдаулар")}
      </Link>
      <PageHeading
        eyebrow={a.tender.identifier || t("АНАЛИЗ ДОКУМЕНТА", "ҚҰЖАТТЫ ТАЛДАУ")}
        title={a.tender.title}
        subtitle={
          (a.tender.region || t("Регион не указан", "Өңір көрсетілмеген")) +
          " · " +
          date(a.created_at)
        }
        action={
          <Button asChild>
            <a href={"/api/analyses/" + id + "/report?lang=" + locale} download>
              <Download size={16} />
              {t("PDF-отчёт", "PDF есебі")}
            </a>
          </Button>
        }
      />
      <div className="analysis-meta">
        <span
          className={"tag " + (a.tender.synthetic ? "tag-amber" : "tag-blue")}
        >
          {a.tender.synthetic
            ? t("Синтетический учебный пример", "Синтетикалық оқу мысалы")
            : t("Загруженный документ", "Жүктелген құжат")}
        </span>
        <span className="mode-label">
          <ShieldCheck size={14} />
          {a.mode === "gemini"
            ? t(
                "Gemini + программные проверки",
                "Gemini + бағдарламалық тексерулер",
              )
            : t(
                "Локальная детерминированная обработка",
                "Жергілікті детерминирленген өңдеу",
              )}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <FileText size={14} />
          {t("Исправить данные", "Деректерді түзету")}
        </Button>
      </div>
      <div className="analysis-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "summary" && (
          <Summary
            a={a}
            openMatrix={() => setTab("matrix")}
            openFinance={() => setTab("finance")}
            openRisks={() => setTab("risks")}
          />
        )}
        {tab === "matrix" && <Matrix a={a} onSource={setSource} />}{" "}
        {tab === "finance" && <Simulator a={a} />}{" "}
        {tab === "risks" && <Risks a={a} />}{" "}
        {tab === "details" && <Details a={a} />}
      </div>
      {rerun.isError && <ErrorState error={rerun.error} />}
      <SourceDialog a={a} row={source} close={() => setSource(null)} />
    </>
  );
}
function Summary({
  a,
  openMatrix,
  openFinance,
  openRisks,
}: {
  a: Analysis;
  openMatrix: () => void;
  openFinance: () => void;
  openRisks: () => void;
}) {
  const { t } = useLocale();
  const counts = a.matches!.counts;
  const blockers =
    a.risks?.filter(
      (r) => r.severity === "critical" || r.severity === "high",
    ) || [];
  return (
    <>
      <section
        data-testid="decision"
        className={"decision-strip " + a.decision}
      >
        <div className="decision-icon">
          {a.decision === "READY_FOR_REVIEW" ? (
            <ShieldCheck size={25} />
          ) : (
            <AlertTriangle size={25} />
          )}
        </div>
        <div>
          <span className="eyebrow">
            {t("РЕШЕНИЕ ПО ТЕКУЩИМ ДАННЫМ", "АҒЫМДАҒЫ ДЕРЕКТЕР БОЙЫНША ШЕШІМ")}
          </span>
          <h2>
            <DecisionBadge a={a} />
          </h2>
          <p>
            {a.decision === "READY_FOR_REVIEW"
              ? t(
                  "Проверенные значения совпадают. Перед участием проверьте первичные документы и договор.",
                  "Тексерілген мәндер сәйкес. Қатысу алдында бастапқы құжаттар мен шартты тексеріңіз.",
                )
              : t(
                  "Прибыльность не подтверждает готовность к участию. Сначала устраните неизвестные сведения и препятствия.",
                  "Пайдалылық қатысуға дайындықты растамайды. Алдымен белгісіз деректер мен кедергілерді жойыңыз.",
                )}
          </p>
        </div>
        <Button variant="secondary" onClick={openRisks}>
          {t("Что проверить", "Нені тексеру керек")}
          <ArrowRight size={15} />
        </Button>
      </section>
      <FinanceMetrics a={a} />
      <div className="results-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t("Совместимость с каталогом", "Каталогпен сәйкестік")}</h2>
            <Button variant="ghost" size="sm" onClick={openMatrix}>
              {t("Открыть матрицу", "Матрицаны ашу")}
              <ArrowRight size={14} />
            </Button>
          </div>
          <div className="compatibility-bar">
            {(
              [
                "VERIFIED_MATCH",
                "CONFLICT",
                "PARTIAL_MATCH",
                "UNKNOWN",
              ] as Status[]
            ).map((s) => (
              <span
                className={"segment-" + s}
                key={s}
                style={{
                  flex: counts[s] || 0,
                  display: counts[s] ? "block" : "none",
                }}
              />
            ))}
          </div>
          <div className="compatibility-list">
            {(
              [
                "VERIFIED_MATCH",
                "CONFLICT",
                "PARTIAL_MATCH",
                "UNKNOWN",
              ] as Status[]
            ).map((s) => (
              <div key={s}>
                <StatusBadge status={s} />
                <strong>{counts[s]}</strong>
              </div>
            ))}
          </div>
          <p className="panel-note">
            {t(
              "Счётчики относятся к основным кандидатам. Альтернативы доступны в матрице.",
              "Есептегіштер негізгі кандидаттарға қатысты. Баламалар матрицада қолжетімді.",
            )}
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t("План дозакупки", "Қосымша сатып алу жоспары")}</h2>
            <Boxes size={18} />
          </div>
          {a.matches!.selected.map((s, i) => (
            <div className="purchase-row" key={i}>
              <div>
                <strong>{s.item}</strong>
                <small>
                  {s.product?.supplier ||
                    t("Поставщик не указан", "Жеткізуші көрсетілмеген")}
                </small>
              </div>
              <div>
                <strong>{s.missing ?? "?"}</strong>
                <small>{t("ед. не хватает", "бірл. жетіспейді")}</small>
              </div>
            </div>
          ))}
          <Button variant="ghost" className="full-width" onClick={openFinance}>
            {t("Проверить расходы и деньги", "Шығындар мен қаражатты тексеру")}
            <ArrowRight size={14} />
          </Button>
        </section>
      </div>
      <section className="panel next-actions">
        <div className="panel-heading">
          <h2>{t("До подачи предложения", "Ұсыныс бермес бұрын")}</h2>
          <span className="tag">
            {blockers.length} {t("вопросов", "сұрақ")}
          </span>
        </div>
        {blockers.slice(0, 5).map((r, i) => (
          <div className="action-row" key={r.id}>
            <span className="action-number">{i + 1}</span>
            <div>
              <strong>{r.title}</strong>
              <p>{r.action}</p>
            </div>
            <span className={"severity " + r.severity}>
              {r.severity === "critical"
                ? t("Критичный", "Сыни")
                : t("Высокий", "Жоғары")}
            </span>
          </div>
        ))}
        {!blockers.length && (
          <p className="panel-note">
            {t(
              "Проверьте актуальность каталога и условия договора перед участием.",
              "Қатысу алдында каталогтың өзектілігін және шарт талаптарын тексеріңіз.",
            )}
          </p>
        )}
      </section>
    </>
  );
}
function Matrix({
  a,
  onSource,
}: {
  a: Analysis;
  onSource: (m: MatrixRow) => void;
}) {
  const { t } = useLocale();
  const [filter, setFilter] = useState("ALL");
  const [candidate, setCandidate] = useState("all");
  const [search, setSearch] = useState("");
  const rows = a.matches!.matrix.filter(
    (m) =>
      (filter === "ALL" || m.status === filter) &&
      (candidate !== "selected" || m.selected) &&
      JSON.stringify(m).toLowerCase().includes(search.toLowerCase()),
  );
  const filters = [
    ["ALL", t("Все", "Барлығы")],
    ["UNKNOWN", t("Нет сведений", "Дерек жоқ")],
    ["CONFLICT", t("Конфликты", "Қайшылықтар")],
    ["PARTIAL_MATCH", t("Частичные", "Ішінара")],
    ["VERIFIED_MATCH", t("Совпадения", "Сәйкестіктер")],
  ];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h2>{t("Проверка каждого требования", "Әр талапты тексеру")}</h2>
          <p>
            {t(
              "Сходство названий помогает найти кандидата. Соответствие подтверждают значения и источники.",
              "Атау ұқсастығы кандидатты табуға көмектеседі. Сәйкестікті мәндер мен дереккөздер растайды.",
            )}
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href={"/api/analyses/" + a.id + "/matrix.xlsx"} download>
            <Download size={15} />
            XLSX
          </a>
        </Button>
      </div>
      <div className="matrix-controls">
        <div className="filter-buttons">
          {filters.map(([key, label]) => (
            <button
              aria-label={label}
              className={filter === key ? "active" : ""}
              key={key}
              onClick={() => setFilter(key)}
            >
              {label}
              <span>
                {key === "ALL"
                  ? a.matches!.matrix.length
                  : a.matches!.matrix.filter((m) => m.status === key).length}
              </span>
            </button>
          ))}
        </div>
        <div className="matrix-search">
          <label className="search-input">
            <Search size={15} />
            <input
              aria-label={t("Поиск по требованиям", "Талаптарды іздеу")}
              placeholder={t("Поиск по требованиям", "Талаптарды іздеу")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label={t("Кандидаты", "Кандидаттар")}
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
          >
            <option value="all">
              {t("Все кандидаты", "Барлық кандидаттар")}
            </option>
            <option value="selected">
              {t("Только основные", "Тек негізгілері")}
            </option>
          </select>
        </div>
      </div>
      <section className="panel matrix-panel">
        <div className="table-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>{t("Требование / источник", "Талап / дереккөз")}</th>
                <th>{t("Требуемое значение", "Қажетті мән")}</th>
                <th>{t("Товар из каталога", "Каталог тауары")}</th>
                <th>{t("Сведения каталога", "Каталог деректері")}</th>
                <th>{t("Результат и действие", "Нәтиже және әрекет")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.property}</strong>
                    <small>{m.item}</small>
                    <span className="source-tag">
                      PDF · {m.page}
                      {m.origin === "manual"
                        ? " · " + t("Исправлено вручную", "Қолмен түзетілген")
                        : ""}
                    </span>
                  </td>
                  <td>
                    <strong>
                      {m.required || t("Не указано", "Көрсетілмеген")}
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {m.product_name || t("Не найден", "Табылмады")}
                    </strong>
                    <small>
                      {m.sku || "—"} ·{" "}
                      {m.selected
                        ? t("Основной кандидат", "Негізгі кандидат")
                        : t("Альтернатива", "Балама")}
                    </small>
                  </td>
                  <td>
                    <span>{m.actual || t("Нет данных", "Дерек жоқ")}</span>
                    <small>
                      {t("Строка", "Жол")} {m.row || "—"}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={m.status} />
                    <p className="matrix-explanation">{m.explanation}</p>
                    <small>{m.action}</small>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSource(m)}
                    >
                      <FileSearch size={15} />
                      {t("Источник", "Дереккөз")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="panel-empty">
              {t(
                "Нет требований по выбранному фильтру.",
                "Таңдалған сүзгі бойынша талаптар жоқ.",
              )}
            </p>
          )}
        </div>
      </section>
      <div className="notice compact">
        <HelpCircle size={18} />
        <p>
          {t(
            "«Совпадает» означает совпадение указанных значений. Документы соответствия и сведения поставщика требуют первичной проверки.",
            "«Сәйкес» көрсетілген мәндердің сәйкестігін білдіреді. Сәйкестік құжаттары мен жеткізуші деректері бастапқы тексеруді қажет етеді.",
          )}
        </p>
      </div>
    </>
  );
}
function SourceDialog({
  a,
  row,
  close,
}: {
  a: Analysis;
  row: MatrixRow | null;
  close: () => void;
}) {
  const { t } = useLocale();
  const page = a.sources.pages.find((p) => p.page === row?.page);
  return (
    <Dialog
      open={!!row}
      onOpenChange={(o) => !o && close()}
      title={t("Доказательства требования", "Талап дәлелдері")}
      wide
    >
      {row && (
        <>
          <div className="evidence-grid">
            <section>
              <div className="evidence-heading">
                <FileText size={18} />
                <strong>
                  {t("Страница", "Бет")} {row.page}
                </strong>
                <a
                  className="icon-button"
                  href={"/api/analyses/" + a.id + "/source#page=" + row.page}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("Открыть исходный PDF", "Бастапқы PDF ашу")}
                >
                  <ExternalLink size={15} />
                </a>
              </div>
              <p className="muted">
                {a.sources.name} {page?.ocr ? "· OCR" : ""}
              </p>
              <blockquote>{row.requirement}</blockquote>
              <details>
                <summary>
                  {t("Весь текст страницы", "Беттің толық мәтіні")}
                </summary>
                <pre className="source-text">{page?.text}</pre>
              </details>
              {row.origin === "manual" && (
                <p className="field-error">
                  {t(
                    "Значение исправлено пользователем. Цитата сохраняет исходный текст.",
                    "Мәнді пайдаланушы түзетті. Дәйексөз бастапқы мәтінді сақтайды.",
                  )}
                </p>
              )}
            </section>
            <section>
              <div className="evidence-heading">
                <Boxes size={18} />
                <strong>
                  {t("Строка каталога", "Каталог жолы")} {row.row || "—"}
                </strong>
              </div>
              <p className="muted">
                {row.product_name || t("Товар не найден", "Тауар табылмады")}
              </p>
              <div className="evidence-values">
                <span>
                  {t("Требуется", "Қажет")}
                  <b>{row.required || "—"}</b>
                </span>
                <span>
                  {t("В каталоге", "Каталогта")}
                  <b>{row.actual || "—"}</b>
                </span>
              </div>
              <StatusBadge status={row.status} />
              <dl className="raw-values">
                {Object.entries(row.inventory_evidence).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <div className="evidence-action">
            <strong>{t("Следующее действие", "Келесі әрекет")}</strong>
            <p>{row.action}</p>
          </div>
        </>
      )}
    </Dialog>
  );
}
const nonnegative = z
  .string()
  .refine(
    (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0,
    "Введите неотрицательное число",
  );
const percent = nonnegative.refine(
  (v) => Number(v) <= 100,
  "Введите от 0 до 100",
);
const schema = z
  .object({
    offer_price: nonnegative,
    delivery: nonnegative,
    packaging: nonnegative,
    other: nonnegative,
    tax_rate: percent,
    target_margin: percent,
    annual_financing_rate: percent,
    payment_days: z.number().int().min(0).max(3650),
    advance_rate: percent,
    cash_available: nonnegative,
    delivery_days: z.number().int().min(0).max(3650),
    line_overrides: z.record(
      z.string(),
      z.record(z.string(), nonnegative.nullable()),
    ),
  })
  .refine((s) => Number(s.tax_rate) + Number(s.target_margin) < 100, {
    path: ["target_margin"],
    message: "Маржа и налог вместе должны быть меньше 100%",
  });
function Simulator({ a }: { a: Analysis }) {
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const form = useForm<Scenario>({
    resolver: zodResolver(schema),
    defaultValues: a.scenario,
  });
  useEffect(() => {
    form.reset(a.scenario);
  }, [a.scenario, form]);
  const mutation = useMutation({
    mutationFn: (scenario: Scenario) =>
      api<Analysis>("/analyses/" + a.id + "/scenario", {
        method: "PUT",
        body: JSON.stringify(scenario),
      }),
    onSuccess: (value) => {
      client.setQueryData(["analysis", a.id], value);
      client.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
  const f = a.financial!;
  const fields: [keyof Scenario, string, string?][] = [
    ["offer_price", t("Цена предложения, ₸", "Ұсыныс бағасы, ₸")],
    ["delivery", t("Доставка, ₸", "Жеткізу, ₸")],
    ["packaging", t("Упаковка, ₸", "Қаптама, ₸")],
    ["other", t("Прочие расходы, ₸", "Өзге шығындар, ₸")],
    ["tax_rate", t("Налоговый резерв, %", "Салық резерві, %")],
    ["target_margin", t("Целевая маржа, %", "Мақсатты маржа, %")],
    [
      "annual_financing_rate",
      t("Финансирование, % годовых", "Қаржыландыру, жылдық %"),
    ],
    ["payment_days", t("Оплата через, дней", "Төлем мерзімі, күн")],
    ["advance_rate", t("Аванс заказчика, %", "Тапсырыс беруші авансы, %")],
    ["cash_available", t("Доступные деньги, ₸", "Қолжетімді қаражат, ₸")],
    ["delivery_days", t("План поставки, дней", "Жеткізу жоспары, күн")],
  ];
  const costData = [
    { name: t("Запасы", "Қор"), value: Number(f.inventory_cost || 0) },
    { name: t("Закупка", "Сатып алу"), value: Number(f.purchase_cost || 0) },
    { name: t("Доставка", "Жеткізу"), value: Number(f.delivery) },
    {
      name: t("Прочее", "Өзге"),
      value:
        Number(f.packaging) +
        Number(f.other) +
        Number(f.tax) +
        Number(f.financing_cost || 0),
    },
  ];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h2>
            {t(
              "Проверьте экономику исполнения",
              "Орындау экономикасын тексеріңіз",
            )}
          </h2>
          <p>
            {t(
              "Изменяйте допущения. Расчёт выполняется на сервере и сохраняется.",
              "Болжамдарды өзгертіңіз. Есеп серверде орындалады және сақталады.",
            )}
          </p>
        </div>
        <span className="tag">
          {t("Сохранённый сценарий", "Сақталған сценарий")} · KZT
        </span>
      </div>
      <div className="simulator-grid">
        <form
          className="panel simulator-form"
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <div className="panel-heading">
            <h2>
              <SlidersHorizontal size={18} />
              {t("Ваш сценарий", "Сіздің сценарийіңіз")}
            </h2>
          </div>
          <div className="form-grid">
            {fields.map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  step={key.endsWith("days") ? "1" : "0.01"}
                  {...form.register(
                    key as Exclude<keyof Scenario, "line_overrides">,
                    { valueAsNumber: key.endsWith("days") },
                  )}
                />
                {form.formState.errors[key]?.message && (
                  <span className="field-error">
                    {t(
                      String(form.formState.errors[key]?.message),
                      "Енгізілген мәнді тексеріңіз",
                    )}
                  </span>
                )}
              </label>
            ))}
          </div>
          <p className="form-note">
            {t(
              "Налог — доля выручки для моделирования. Проверьте применимый режим со своим бухгалтером. Аванс считается доступным в день закупки.",
              "Салық — модельдеуге арналған түсім үлесі. Қолданыстағы режимді бухгалтермен тексеріңіз. Аванс сатып алу күні қолжетімді деп есептеледі.",
            )}
          </p>
          <details className="line-controls">
            <summary>
              {t(
                "Количество и стоимость по товарам",
                "Тауарлар бойынша сан және құн",
              )}
            </summary>
            {a.matches!.cost_lines.map((line, i) => (
              <div key={i} className="line-override">
                <h3>{line.name}</h3>
                {(
                  [
                    ["quantity", t("Нужно, ед.", "Қажет, бірл.")],
                    ["available", t("В наличии, ед.", "Қорда, бірл.")],
                    [
                      "acquisition_cost",
                      t("Стоимость запаса за ед., ₸", "Қор бірлігінің құны, ₸"),
                    ],
                    [
                      "supplier_cost",
                      t("Цена дозакупки за ед., ₸", "Қосымша бірлік бағасы, ₸"),
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={
                        a.scenario.line_overrides[String(i)]?.[key] ??
                        line[key] ??
                        ""
                      }
                      {...form.register(`line_overrides.${i}.${key}`, {
                        setValueAs: (v) => (v === "" ? null : String(v)),
                      })}
                    />
                  </label>
                ))}
              </div>
            ))}
          </details>
          <Button
            type="submit"
            className="full-width"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Save size={16} />
            )}{" "}
            {t("Пересчитать", "Қайта есептеу")}
          </Button>
          {mutation.isError && <ErrorState error={mutation.error} />}{" "}
          {mutation.isSuccess && (
            <p className="success-message" role="status">
              {t(
                "Сценарий сохранён. Решение и риски обновлены.",
                "Сценарий сақталды. Шешім мен тәуекелдер жаңартылды.",
              )}
            </p>
          )}
        </form>
        <div className="simulator-results">
          <div className="profit-focus">
            <div>
              <small>{t("Расчётная прибыль", "Есептік пайда")}</small>
              <strong
                data-testid="profit-value"
                className={Number(f.profit) < 0 ? "negative" : "positive"}
              >
                {kzt(f.profit, locale)}
              </strong>
              <p>
                {f.complete
                  ? t(
                      "Экономическая прибыль с учётом стоимости имеющегося товара.",
                      "Қолда бар тауар құнын ескерген экономикалық пайда.",
                    )
                  : t(
                      "Заполните неизвестные количества и цены.",
                      "Белгісіз сан мен бағаларды толтырыңыз.",
                    )}
              </p>
            </div>
            <span className="profit-margin">
              {f.margin == null ? "—" : Number(f.margin).toFixed(1) + "%"}
              <small>{t("маржа", "маржа")}</small>
            </span>
          </div>
          <div className="finance-readings">
            <Metric
              label={t("Общие затраты", "Жалпы шығын")}
              value={kzt(f.total_cost, locale)}
            />
            <Metric
              label={t("Безубыточная цена", "Залалсыз баға")}
              value={kzt(f.break_even, locale)}
            />
            <Metric
              label={t("Цена для целевой маржи", "Мақсатты маржа бағасы")}
              value={kzt(f.target_price, locale)}
            />
            <Metric
              label={t(
                "Дополнительная потребность в деньгах",
                "Қосымша қаражат қажеттілігі",
              )}
              value={kzt(f.incremental_cash, locale)}
            />
          </div>
          <section className="panel chart-panel">
            <div className="panel-heading">
              <h2>{t("Структура расходов", "Шығын құрылымы")}</h2>
              <span>KZT</span>
            </div>
            {f.complete ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={costData}
                  margin={{ top: 10, left: 0, right: 15, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => Number(v) / 1000 + "k"}
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    width={46}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => kzt(String(v))}
                    contentStyle={{
                      background: "var(--panel)",
                      borderColor: "var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="value"
                    fill="#4873d9"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="panel-empty">
                {t(
                  "График недоступен без полной себестоимости.",
                  "Толық өзіндік құнсыз график қолжетімсіз.",
                )}
              </p>
            )}
          </section>
          <section className="panel chart-panel">
            <div className="panel-heading">
              <h2>{t("Денежный поток", "Ақша ағыны")}</h2>
              <span>{t("Остаток денег", "Қаражат қалдығы")}</span>
            </div>
            {f.complete ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={f.cash_flow.map((p, i) => ({
                    ...p,
                    index: i,
                    balance: Number(p.balance),
                    name: t("День", "Күн") + " " + p.day,
                  }))}
                  margin={{ top: 15, left: 0, right: 20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => Number(v) / 1000 + "k"}
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    width={46}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine y={0} stroke="#d45555" strokeDasharray="4 4" />
                  <Tooltip
                    formatter={(v) => kzt(String(v))}
                    contentStyle={{
                      background: "var(--panel)",
                      borderColor: "var(--border)",
                    }}
                  />
                  <Line
                    isAnimationActive={false}
                    dataKey="balance"
                    stroke="#20866e"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    type="linear"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="panel-empty">
                {t(
                  "Денежная потребность пока не определена.",
                  "Қаражат қажеттілігі әлі анықталмаған.",
                )}
              </p>
            )}
            <p className="panel-note">
              {t(
                "Стоимость старого запаса влияет на прибыль, но не создаёт новую выплату. Налог зарезервирован в день 0.",
                "Ескі қор құны пайдаға әсер етеді, бірақ жаңа төлем туғызбайды. Салық 0-күні резервтеледі.",
              )}
            </p>
          </section>
        </div>
      </div>
      <section className="panel financial-detail">
        <h2>{t("Прозрачный расчёт", "Ашық есептеу")}</h2>
        <p>
          {t(
            f.formula,
            "Пайда = ұсыныс − қор құны − сатып алу − жеткізу − қаптама − өзге шығындар − салық резерві − қаржыландыру",
          )}
        </p>
        <dl>
          {[
            ["inventory_cost", t("Стоимость запасов", "Қор құны")],
            ["purchase_cost", t("Дозакупка", "Қосымша сатып алу")],
            ["delivery", t("Доставка", "Жеткізу")],
            ["packaging", t("Упаковка", "Қаптама")],
            ["other", t("Прочие расходы", "Өзге шығындар")],
            ["tax", t("Налоговый резерв", "Салық резерві")],
            ["financing_cost", t("Финансирование", "Қаржыландыру")],
          ].map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{kzt(f[key as "inventory_cost"], locale)}</dd>
            </div>
          ))}
        </dl>
        {f.warnings.map((w, i) => (
          <p className="financial-warning" key={i}>
            <AlertTriangle size={15} />
            {w}
          </p>
        ))}
      </section>
    </>
  );
}
function Risks({ a }: { a: Analysis }) {
  const { t } = useLocale();
  const [group, setGroup] = useState("all");
  const groups: Record<string, string> = {
    technical: t("Техническое соответствие", "Техникалық сәйкестік"),
    inventory: t("Наличие товаров", "Тауарлардың болуы"),
    documentation: t("Документы", "Құжаттар"),
    delivery: t("Сроки поставки", "Жеткізу мерзімдері"),
    financial: t("Финансовые риски", "Қаржылық тәуекелдер"),
    cash_flow: t("Денежный поток", "Ақша ағыны"),
    contract: t("Условия договора", "Шарт талаптары"),
    restrictive: t("Узкие требования", "Тар талаптар"),
  };
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h2>
            {t(
              "Риски, которые требуют действий",
              "Әрекетті қажет ететін тәуекелдер",
            )}
          </h2>
          <p>
            {t(
              "Факты, источники и практические следующие шаги.",
              "Фактілер, дереккөздер және практикалық келесі қадамдар.",
            )}
          </p>
        </div>
        <select
          aria-label={t("Группа риска", "Тәуекел тобы")}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="all">{t("Все группы", "Барлық топтар")}</option>
          {Object.entries(groups).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="risk-list">
        {a.risks
          ?.filter((r) => group === "all" || r.group === group)
          .map((r) => (
            <section className="panel risk-card" key={r.id}>
              <div className="risk-card-top">
                <span className={"risk-icon " + r.severity}>
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <span className="eyebrow">{groups[r.group]}</span>
                  <h2>{r.title}</h2>
                </div>
                <span className={"severity " + r.severity}>
                  {r.severity === "critical"
                    ? t("Критичный", "Сыни")
                    : r.severity === "high"
                      ? t("Высокий", "Жоғары")
                      : t("Умеренный", "Орташа")}
                </span>
              </div>
              <p>{r.description}</p>
              <div className="risk-impact">
                <strong>{t("Для бизнеса", "Бизнес үшін")}</strong>
                <p>{r.consequence}</p>
              </div>
              <div className="risk-next">
                <ArrowRight size={16} />
                <p>{r.action}</p>
              </div>
              {r.evidence && (
                <blockquote>
                  <span className="source-tag">PDF · {r.page}</span>
                  {r.evidence}
                </blockquote>
              )}
              <small className="risk-method">
                {r.method === "ai_assisted"
                  ? t("AI-предварительный вывод", "AI алдын ала қорытындысы")
                  : r.method === "wording_rule"
                    ? t(
                        "Правило анализа формулировки",
                        "Тұжырымды талдау ережесі",
                      )
                    : t(
                        "Детерминированная проверка",
                        "Детерминирленген тексеру",
                      )}
              </small>
            </section>
          ))}
      </div>
      {!a.risks?.length && (
        <div className="notice">
          <Check size={20} />
          <p>
            {t(
              "Текущие правила не выявили рисков. Проверьте договор и первичные документы.",
              "Ағымдағы ережелер тәуекелдерді анықтамады. Шарт пен бастапқы құжаттарды тексеріңіз.",
            )}
          </p>
        </div>
      )}
      <p className="muted">
        {t(
          "Предварительная оценка не является юридическим заключением и не гарантирует допуск к закупке.",
          "Алдын ала бағалау заңдық қорытынды емес және сатып алуға қатысуға рұқсатты кепілдемейді.",
        )}
      </p>
    </>
  );
}
function Details({ a }: { a: Analysis }) {
  const { t, locale } = useLocale();
  const tender = a.tender;
  return (
    <div className="details-grid">
      <section className="panel detail-panel">
        <h2>{t("Паспорт закупки", "Сатып алу паспорты")}</h2>
        <dl>
          {[
            ["identifier", t("Идентификатор", "Сәйкестендіргіш")],
            ["buyer", t("Заказчик", "Тапсырыс беруші")],
            ["region", t("Регион", "Өңір")],
            ["source", t("Источник", "Дереккөз")],
            ["method", t("Способ закупки", "Сатып алу тәсілі")],
            ["deadline", t("Срок подачи", "Өтінім мерзімі")],
            ["delivery_date", t("Дата поставки", "Жеткізу күні")],
          ].map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {String(
                  tender[key as "identifier"] ||
                    t("Не указано", "Көрсетілмеген"),
                )}
              </dd>
            </div>
          ))}
          <div>
            <dt>{t("Бюджет", "Бюджет")}</dt>
            <dd>{kzt(tender.budget, locale)}</dd>
          </div>
        </dl>
        <a
          className="text-link"
          href={"/api/analyses/" + a.id + "/source"}
          target="_blank"
          rel="noreferrer"
        >
          <FileText size={16} />
          {t("Открыть исходный PDF", "Бастапқы PDF ашу")}
        </a>
      </section>
      <section className="panel detail-panel">
        <h2>{t("Доставка и оплата", "Жеткізу және төлем")}</h2>
        <h3>{t("Поставка", "Жеткізу")}</h3>
        <blockquote>
          {tender.delivery_evidence ||
            t("Не удалось определить", "Анықтау мүмкін болмады")}
        </blockquote>
        <h3>{t("Оплата", "Төлем")}</h3>
        <blockquote>
          {tender.payment_evidence ||
            t("Не удалось определить", "Анықтау мүмкін болмады")}
        </blockquote>
        <p className="muted">
          {t(
            "Неопределённые условия остаются допущениями сценария.",
            "Анықталмаған шарттар сценарий болжамы болып қалады.",
          )}
        </p>
      </section>
      <section className="panel detail-panel full-span">
        <h2>{t("Товары и условия", "Тауарлар мен шарттар")}</h2>
        {tender.items.map((line, i) => (
          <div className="detail-item" key={i}>
            <strong>
              {line.name} · {line.quantity || "?"} {line.unit}
            </strong>
            <span className="source-tag">PDF · {line.page}</span>
            <ul>
              {line.requirements.map((r, j) => (
                <li key={j}>
                  {r.label}: {r.value} <small>PDF · {r.page}</small>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {tender.constraints.map((r, i) => (
          <blockquote key={i}>
            {r.evidence} · PDF {r.page}
          </blockquote>
        ))}
      </section>
    </div>
  );
}
function Review({
  a,
  onFinish,
  onCancel,
}: {
  a: Analysis;
  onFinish: () => void;
  onCancel?: () => void;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<Tender>(() => structuredClone(a.tender));
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const update = (key: keyof Tender, value: string | null) =>
    setDraft({ ...draft, [key]: value });
  const save = useMutation({
    mutationFn: async () => {
      await api("/analyses/" + a.id + "/tender", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      return api<Analysis>("/analyses/" + a.id + "/run", { method: "POST" });
    },
    onSuccess: (value) => {
      client.setQueryData(["analysis", a.id], value);
      client.invalidateQueries({ queryKey: ["analyses"] });
      onFinish();
    },
  });
  function editItem(i: number, fn: (item: Tender["items"][number]) => void) {
    const d = structuredClone(draft);
    fn(d.items[i]);
    setDraft(d);
  }
  return (
    <>
      <PageHeading
        title={t(
          "Проверьте извлечённые данные",
          "Алынған деректерді тексеріңіз",
        )}
        subtitle={t(
          "Сверьте товары и характеристики с оригиналом. Исправления сохраняются в журнале.",
          "Тауарлар мен сипаттамаларды түпнұсқамен салыстырыңыз. Түзетулер журналда сақталады.",
        )}
        action={
          onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              {t("Отмена", "Бас тарту")}
            </Button>
          )
        }
      />
      <div className="wizard-steps">
        <div className="done">
          <Check size={16} />
          {t("Документы", "Құжаттар")}
        </div>
        <div className="active">
          <span>2</span>
          {t("Проверка данных", "Деректерді тексеру")}
        </div>
        <div>
          <span>3</span>
          {t("Анализ и решение", "Талдау және шешім")}
        </div>
      </div>
      {draft.warnings.map((w, i) => (
        <div className="notice compact" key={i}>
          <AlertTriangle size={17} />
          <p>{w}</p>
        </div>
      ))}
      <div className="review-grid">
        <div>
          <section className="panel review-form">
            <h2>{t("Данные закупки", "Сатып алу деректері")}</h2>
            <div className="form-grid">
              {[
                ["title", t("Название", "Атауы")],
                ["buyer", t("Заказчик", "Тапсырыс беруші")],
                ["region", t("Регион", "Өңір")],
                ["budget", t("Бюджет, ₸", "Бюджет, ₸")],
                ["identifier", t("Номер", "Нөмірі")],
                ["deadline", t("Срок подачи", "Өтінім мерзімі")],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    type={key === "budget" ? "number" : "text"}
                    min={key === "budget" ? "0" : undefined}
                    value={String(draft[key as "title"] || "")}
                    onChange={(e) =>
                      update(key as keyof Tender, e.target.value || null)
                    }
                    placeholder={t("Не указано", "Көрсетілмеген")}
                  />
                </label>
              ))}
            </div>
          </section>
          {draft.items.map((item, i) => (
            <section className="panel review-item" key={i}>
              <div className="panel-heading">
                <h2>
                  {t("Позиция", "Позиция")} {i + 1}
                </h2>
                <button
                  className="icon-button"
                  aria-label={t("Удалить позицию", "Позицияны жою")}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      items: draft.items.filter((_, j) => i !== j),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <label className="field">
                {t("Наименование товара", "Тауар атауы")}
                <input
                  value={item.name}
                  onChange={(e) =>
                    editItem(i, (line) => (line.name = e.target.value))
                  }
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  {t("Количество", "Саны")}
                  <input
                    type="number"
                    min="0"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      editItem(
                        i,
                        (line) => (line.quantity = e.target.value || null),
                      )
                    }
                  />
                </label>
                <label className="field">
                  {t("Единица", "Өлшем бірлігі")}
                  <input
                    value={item.unit}
                    onChange={(e) =>
                      editItem(i, (line) => (line.unit = e.target.value))
                    }
                  />
                </label>
              </div>
              <div className="requirement-editors">
                {item.requirements.map((r, j) => (
                  <div className="requirement-editor" key={j}>
                    <label className="field">
                      {t("Характеристика", "Сипаттама")}
                      <select
                        aria-label={t("Тип характеристики", "Сипаттама түрі")}
                        value={r.key}
                        onChange={(e) =>
                          editItem(i, (line) => {
                            line.requirements[j].key = e.target.value;
                            line.requirements[j].label =
                              e.target.selectedOptions[0].text;
                          })
                        }
                      >
                        {[
                          ["volume", t("Фасовка / объём", "Қаптама / көлемі")],
                          ["dimensions", t("Размеры", "Өлшемдері")],
                          ["color", t("Цвет", "Түсі")],
                          ["material", t("Материал", "Материал")],
                          ["brand", t("Бренд", "Бренд")],
                          ["standard", t("Стандарт", "Стандарт")],
                          [
                            "certificate",
                            t("Документ соответствия", "Сәйкестік құжаты"),
                          ],
                        ].map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={r.label}
                        value={r.value}
                        onChange={(e) =>
                          editItem(
                            i,
                            (line) =>
                              (line.requirements[j].value = e.target.value),
                          )
                        }
                      />
                    </label>
                    <button
                      className="source-tag"
                      onClick={() => setPage(r.page)}
                    >
                      PDF · {r.page}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={t("Удалить требование", "Талапты жою")}
                      onClick={() =>
                        editItem(i, (line) => line.requirements.splice(j, 1))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editItem(i, (line) =>
                    line.requirements.push({
                      key: "material",
                      label: t("Материал", "Материал"),
                      value: "",
                      page: item.page,
                      evidence: item.evidence,
                      critical: true,
                      confidence: 0,
                      origin: "manual",
                    }),
                  )
                }
              >
                <Plus size={14} />
                {t("Добавить характеристику", "Сипаттама қосу")}
              </Button>
              <p className="source-snippet">{item.evidence}</p>
            </section>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  {
                    name: "",
                    quantity: null,
                    unit: "шт",
                    page: 1,
                    evidence: "",
                    category: null,
                    requirements: [],
                  },
                ],
              })
            }
          >
            <Plus size={15} />
            {t("Добавить товар", "Тауар қосу")}
          </Button>
        </div>
        <section className="panel source-review">
          <div className="panel-heading">
            <h2>{t("Исходный PDF", "Бастапқы PDF")}</h2>
            <a
              className="icon-button"
              href={"/api/analyses/" + a.id + "/source"}
              target="_blank"
              rel="noreferrer"
              aria-label={t("Открыть PDF", "PDF ашу")}
            >
              <ExternalLink size={16} />
            </a>
          </div>
          <div className="page-picker">
            {a.sources.pages.map((p) => (
              <button
                key={p.page}
                className={p.page === page ? "active" : ""}
                onClick={() => setPage(p.page)}
              >
                {t("Стр.", "Бет")} {p.page}
              </button>
            ))}
          </div>
          <pre className="source-text">
            {a.sources.pages.find((p) => p.page === page)?.text}
          </pre>
        </section>
      </div>
      <div className="review-submit">
        <p>
          <ShieldCheck size={16} />
          {t(
            "Неизвестные значения не станут подтверждённым соответствием.",
            "Белгісіз мәндер расталған сәйкестікке айналмайды.",
          )}
        </p>
        <Button
          onClick={() => save.mutate()}
          disabled={
            save.isPending ||
            !draft.items.length ||
            draft.items.some((i) => !i.name.trim())
          }
        >
          {save.isPending ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {t("Запустить анализ", "Талдауды іске қосу")}
        </Button>
      </div>
      {save.isError && <ErrorState error={save.error} />}
    </>
  );
}
