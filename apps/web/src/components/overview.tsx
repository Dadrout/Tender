"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import {
  Plus,
  ArrowUpRight,
  FileText,
  ArrowRight,
  FlaskConical,
  Download,
  RotateCcw,
  Search,
  Check,
  LoaderCircle,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Compass,
} from "lucide-react";
import { api, kzt, date } from "@/lib/api";
import { Analysis, Discovery, Job } from "@/lib/types";
import { useLocale } from "@/lib/context";
import { Button } from "./ui/button";
import {
  DecisionBadge,
  Empty,
  ErrorState,
  Loading,
  Metric,
  PageHeading,
} from "./shared";

export function Dashboard() {
  const { t, locale } = useLocale();
  const q = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api<Analysis[]>("/analyses"),
  });
  const data = q.data || [];
  const completed = data.filter((a) => a.state === "completed");
  const review = completed.filter(
    (a) => a.decision === "REQUIRES_ATTENTION",
  ).length;
  const feasible = completed.filter(
    (a) =>
      a.financial?.complete &&
      Number(a.financial.profit) > 0 &&
      a.decision !== "NOT_FEASIBLE",
  ).length;
  const blocked = completed.filter((a) => a.decision === "NOT_FEASIBLE").length;
  const distribution = [
    {
      name: t("Критичные", "Сыни"),
      value: completed.reduce(
        (v, a) =>
          v + (a.risks?.filter((r) => r.severity === "critical").length || 0),
        0,
      ),
      color: "#d45555",
    },
    {
      name: t("Высокие", "Жоғары"),
      value: completed.reduce(
        (v, a) =>
          v + (a.risks?.filter((r) => r.severity === "high").length || 0),
        0,
      ),
      color: "#d99235",
    },
    {
      name: t("Умеренные", "Орташа"),
      value: completed.reduce(
        (v, a) =>
          v + (a.risks?.filter((r) => r.severity === "medium").length || 0),
        0,
      ),
      color: "#5477c6",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={t("ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО", "СІЗДІҢ ЖҰМЫС КЕҢІСТІГІҢІЗ")}
        title={t("Обзор возможностей", "Мүмкіндіктерге шолу")}
        subtitle={t(
          "Решайте, в каких закупках участвовать, опираясь на факты.",
          "Қай сатып алуға қатысу керегін фактілерге сүйеніп шешіңіз.",
        )}
        action={
          <Button asChild>
            <Link href="/new">
              <Plus size={17} />
              {t("Новый анализ", "Жаңа талдау")}
            </Link>
          </Button>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <div className="metric-grid dashboard-metrics">
            <Metric
              label={t("Всего анализов", "Барлық талдаулар")}
              value={String(data.length)}
              foot={t(
                "Сохранено в вашем пространстве",
                "Кеңістігіңізде сақталған",
              )}
            />
            <Metric
              label={t("Требуют внимания", "Назар аударуды қажет етеді")}
              value={String(review)}
              foot={t("Есть вопросы до участия", "Қатысу алдында сұрақтар бар")}
            />
            <Metric
              label={t("Потенциально прибыльные", "Әлеуетті пайдалы")}
              value={String(feasible)}
              foot={t(
                "При введённых допущениях",
                "Енгізілген болжамдар бойынша",
              )}
              tone="positive"
            />
            <Metric
              label={t("Критичные препятствия", "Сыни кедергілер")}
              value={String(blocked)}
              foot={t(
                "Текущий сценарий невыполним",
                "Ағымдағы сценарий орындалмайды",
              )}
            />
          </div>
          {data.length === 0 ? (
            <Empty
              title={t(
                "Первое решение начинается с документов",
                "Алғашқы шешім құжаттардан басталады",
              )}
              description={t(
                "Загрузите спецификацию и каталог или изучите синтетический тендер магазина в Таразе.",
                "Спецификация мен каталогты жүктеңіз немесе Тараз дүкенінің синтетикалық тендерін зерттеңіз.",
              )}
              action={
                <div className="button-row">
                  <Button asChild>
                    <Link href="/new">
                      {t("Загрузить документы", "Құжаттарды жүктеу")}
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/demo">{t("Открыть демо", "Демоны ашу")}</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="overview-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>{t("Последние анализы", "Соңғы талдаулар")}</h2>
                  <span className="count">{data.length}</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Закупка", "Сатып алу")}</th>
                        <th>{t("Решение", "Шешім")}</th>
                        <th>{t("Прибыль", "Пайда")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(0, 8).map((a) => (
                        <tr key={a.id}>
                          <td>
                            <Link
                              className="table-title"
                              href={"/analyses/" + a.id}
                            >
                              {a.tender.title}
                            </Link>
                            <small>
                              {a.synthetic
                                ? t("Учебный пример", "Оқу мысалы")
                                : t(
                                    "Загруженный документ",
                                    "Жүктелген құжат",
                                  )}{" "}
                              · {date(a.created_at)}
                            </small>
                          </td>
                          <td>
                            <DecisionBadge a={a} />
                          </td>
                          <td className="number-cell">
                            {kzt(a.financial?.profit, locale)}
                          </td>
                          <td>
                            <Link
                              className="icon-button"
                              href={"/analyses/" + a.id}
                              aria-label={t("Открыть анализ", "Талдауды ашу")}
                            >
                              <ArrowUpRight size={17} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <aside className="panel risk-distribution">
                <div className="panel-heading">
                  <h2>{t("Карта рисков", "Тәуекел картасы")}</h2>
                </div>
                {distribution.some((x) => x.value > 0) ? (
                  <>
                    <div className="donut">
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie
                            data={distribution.filter((x) => x.value)}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={77}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {distribution
                              .filter((x) => x.value)
                              .map((x) => (
                                <Cell key={x.name} fill={x.color} />
                              ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-label">
                        <strong>
                          {distribution.reduce((s, x) => s + x.value, 0)}
                        </strong>
                        <small>{t("находок", "анықтама")}</small>
                      </div>
                    </div>
                    {distribution.map((x) => (
                      <div className="legend-row" key={x.name}>
                        <i style={{ background: x.color }} />
                        <span>{x.name}</span>
                        <b>{x.value}</b>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="panel-empty">
                    {t(
                      "Распределение появится после завершения анализа.",
                      "Талдау аяқталғаннан кейін бөліну көрсетіледі.",
                    )}
                  </p>
                )}
              </aside>
            </div>
          )}
          <section className="activity">
            <h2>{t("Последняя активность", "Соңғы белсенділік")}</h2>
            {data.length ? (
              data.slice(0, 3).map((a) => (
                <div key={a.id}>
                  <span className="activity-icon">
                    <FileText size={15} />
                  </span>
                  <p>
                    {t("Сохранён анализ", "Талдау сақталды")}{" "}
                    <Link href={"/analyses/" + a.id}>{a.tender.title}</Link>
                    <small>{date(a.updated_at)}</small>
                  </p>
                </div>
              ))
            ) : (
              <p className="muted">
                {t(
                  "Здесь появятся ваши загрузки и расчёты.",
                  "Жүктеулеріңіз бен есептеріңіз осында көрсетіледі.",
                )}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
export function Processing({ job }: { job: Job }) {
  const { t } = useLocale();
  const stages = [
    ["pdf_extraction", t("Извлечение PDF", "PDF шығару")],
    ["inventory_import", t("Чтение каталога", "Каталогты оқу")],
    [
      "requirements_extraction",
      t("Структурирование требований", "Талаптарды құрылымдау"),
    ],
    ["review_ready", t("Проверка данных", "Деректерді тексеру")],
    ["matching", t("Сопоставление и расчёт", "Салыстыру және есептеу")],
  ];
  const seen = new Set(job.events.map((e) => e.stage));
  return (
    <div className="processing">
      <div className="processing-header">
        <LoaderCircle className="spin" size={24} />
        <div>
          <h2>{t("Обрабатываем документы", "Құжаттар өңделуде")}</h2>
          <p>
            {t(
              "Этапы отражают реальные операции сервера.",
              "Кезеңдер сервердің нақты әрекеттерін көрсетеді.",
            )}
          </p>
        </div>
      </div>
      <ol>
        {stages.map(([key, label]) => (
          <li key={key} className={seen.has(key) ? "done" : ""}>
            {seen.has(key) && job.stage !== key ? (
              <Check size={17} />
            ) : job.stage === key ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <span className="stage-circle" />
            )}
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
export function Demo() {
  const { t } = useLocale();
  const router = useRouter();
  const client = useQueryClient();
  const [jid, setJid] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["discovery"],
    queryFn: () => api<Discovery[]>("/discovery"),
  });
  const start = useMutation({
    mutationFn: (slug: string) => api<Job>("/demo/" + slug, { method: "POST" }),
    onSuccess: (j) => setJid(j.id),
  });
  const job = useQuery({
    queryKey: ["job", jid],
    queryFn: () => api<Job>("/jobs/" + jid),
    enabled: !!jid,
    refetchInterval: (q) =>
      ["completed", "failed"].includes(q.state.data?.status || "")
        ? false
        : 800,
  });
  useEffect(() => {
    if (job.data?.status === "completed") {
      client.invalidateQueries({ queryKey: ["analyses"] });
      client.invalidateQueries({ queryKey: ["catalogs"] });
      router.push("/analyses/" + job.data.analysis_id);
    }
  }, [job.data, router, client]);
  const reset = useMutation({
    mutationFn: () => api("/demo", { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["analyses"] });
      client.invalidateQueries({ queryKey: ["catalogs"] });
      setJid(null);
    },
  });
  return (
    <>
      <PageHeading
        eyebrow={t("ДЕМО ЗА 90 СЕКУНД", "90 СЕКУНДТЫҚ ДЕМО")}
        title={t(
          "Посмотрите, как работает QazBid AI",
          "QazBid AI жұмысын көріңіз",
        )}
        subtitle={t(
          "Три синтетические закупки. Настоящие документы и расчёты. API-ключ не нужен.",
          "Үш синтетикалық сатып алу. Нақты құжаттар мен есептеулер. API кілті қажет емес.",
        )}
        action={
          <Button
            variant="secondary"
            onClick={() => reset.mutate()}
            disabled={
              reset.isPending ||
              start.isPending ||
              (!!jid && job.data?.status !== "failed")
            }
          >
            <RotateCcw size={16} />
            {t("Сбросить демо", "Демоны қалпына келтіру")}
          </Button>
        }
      />
      <div className="notice">
        <FlaskConical size={20} />
        <div>
          <strong>
            {t(
              "Учебные примеры, не действующие закупки",
              "Оқу мысалдары, қолданыстағы сатып алу емес",
            )}
          </strong>
          <p>
            {t(
              "Демо запускает тот же обработчик PDF, импорт Excel, сопоставление и финансовый модуль, что и ваши загрузки.",
              "Демо жүктеулеріңіздегідей PDF өңдегішін, Excel импортын, салыстыру мен қаржы модулін іске қосады.",
            )}
          </p>
        </div>
      </div>
      {(start.isError || job.data?.status === "failed") && (
        <ErrorState
          error={start.error || new Error(job.data?.error || "Ошибка")}
          retry={() => setJid(null)}
        />
      )}{" "}
      {jid && job.data && job.data.status !== "failed" ? (
        <Processing job={job.data} />
      ) : (
        <div className="demo-grid">
          {q.data
            ?.filter((d) => ["enamel", "brushes", "buckets"].includes(d.id))
            .map((d, i) => (
              <section className="panel demo-card" key={d.id}>
                <div className="demo-number">0{i + 1}</div>
                <span className="tag">
                  {t("Синтетический пример", "Синтетикалық мысал")}
                </span>
                <h2>{d.title}</h2>
                <p>
                  {d.items[0]?.name} · {d.items[0]?.quantity} {d.items[0]?.unit}
                </p>
                <strong className="demo-budget">{kzt(d.budget)}</strong>
                <ul>
                  <li>
                    {t("Проверка характеристик", "Сипаттамаларды тексеру")}
                  </li>
                  <li>
                    {i === 0
                      ? t(
                          "Остаток 8 из 12 · дозакупка",
                          "12-ден 8 қорда · қосымша сатып алу",
                        )
                      : t(
                          "Конфликты и доступность поставщика",
                          "Қайшылықтар мен жеткізуші қолжетімділігі",
                        )}
                  </li>
                  <li>
                    {t(
                      "Прибыль, риски и PDF-отчёт",
                      "Пайда, тәуекелдер және PDF есебі",
                    )}
                  </li>
                </ul>
                <Button
                  onClick={() => start.mutate(d.id)}
                  disabled={start.isPending}
                  className="full-width"
                >
                  {start.isPending
                    ? t("Запускаем…", "Іске қосылуда…")
                    : t("Запустить демо", "Демоны іске қосу")}
                  <ArrowRight size={16} />
                </Button>
                <a
                  className="text-link"
                  href={"/api/demo/files/tender-" + d.id + ".pdf"}
                  download
                >
                  <Download size={14} />
                  {t("Скачать исходный PDF", "Бастапқы PDF жүктеу")}
                </a>
              </section>
            ))}
        </div>
      )}
      <section className="panel demo-files">
        <FileSpreadsheet size={23} />
        <div>
          <h3>{t("Каталог магазина в Таразе", "Тараз дүкенінің каталогы")}</h3>
          <p>
            {t(
              "17 товаров: остатки, цены закупки, поставщики и характеристики.",
              "17 тауар: қалдықтар, сатып алу бағалары, жеткізушілер және сипаттамалар.",
            )}
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href="/api/demo/files/inventory.xlsx" download>
            <Download size={15} />
            {t("Скачать Excel", "Excel жүктеу")}
          </a>
        </Button>
      </section>
      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      <div className="demo-script">
        <h2>{t("Что показать жюри", "Қазылар алқасына не көрсету керек")}</h2>
        <p>
          {t(
            "Откройте эмаль → отфильтруйте конфликт фасовки → покажите нехватку 4 единиц и неизвестный сертификат → увеличьте доставку в симуляторе → скачайте отчёт.",
            "Эмальді ашыңыз → қаптама қайшылығын сүзгілеңіз → 4 бірлік тапшылығын және белгісіз сертификатты көрсетіңіз → симуляторда жеткізу құнын арттырыңыз → есепті жүктеңіз.",
          )}
        </p>
      </div>
      {reset.isSuccess && (
        <p className="success-message" role="status">
          {t(
            "Демо удалено. Ваши импортированные анализы сохранены.",
            "Демо жойылды. Импортталған талдауларыңыз сақталды.",
          )}
        </p>
      )}
      {reset.isError && <ErrorState error={reset.error} />}
    </>
  );
}
export function Reports() {
  const { t, locale } = useLocale();
  const q = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api<Analysis[]>("/analyses"),
  });
  const done = q.data?.filter((a) => a.state === "completed") || [];
  return (
    <>
      <PageHeading
        title={t("Отчёты и результаты", "Есептер мен нәтижелер")}
        subtitle={t(
          "Документы для обсуждения решения с командой и специалистом по закупкам.",
          "Шешімді командамен және сатып алу маманымен талқылауға арналған құжаттар.",
        )}
      />
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : !done.length ? (
        <Empty
          title={t(
            "Отчёт появится после анализа",
            "Есеп талдаудан кейін көрсетіледі",
          )}
          description={t(
            "Обработайте документы и завершите проверку требований.",
            "Құжаттарды өңдеңіз және талаптарды тексеруді аяқтаңыз.",
          )}
          action={
            <Button asChild>
              <Link href="/new">{t("Создать анализ", "Талдау жасау")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="report-list">
          {done.map((a) => (
            <section key={a.id} className="panel report-row">
              <FileText size={27} />
              <div>
                <Link href={"/analyses/" + a.id}>
                  <h2>{a.tender.title}</h2>
                </Link>
                <p>
                  {date(a.updated_at)} ·{" "}
                  {a.tender.region ||
                    t("Регион не указан", "Өңір көрсетілмеген")}{" "}
                  ·{" "}
                  {a.synthetic
                    ? t("Учебный пример", "Оқу мысалы")
                    : t("Импорт", "Импорт")}
                </p>
                <DecisionBadge a={a} />
              </div>
              <div className="report-links">
                <Button asChild>
                  <a
                    href={"/api/analyses/" + a.id + "/report?lang=" + locale}
                    download
                  >
                    <Download size={15} />
                    {t("PDF-отчёт", "PDF есебі")}
                  </a>
                </Button>
                <a href={"/api/analyses/" + a.id + "/matrix.xlsx"} download>
                  {t("Матрица XLSX", "XLSX матрицасы")}
                </a>
                <a href={"/api/analyses/" + a.id + "/financial.csv"} download>
                  {t("Финансы CSV", "CSV қаржысы")}
                </a>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
export function DiscoveryPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["discovery"],
    queryFn: () => api<Discovery[]>("/discovery"),
  });
  const aq = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api<Analysis[]>("/analyses"),
  });
  const data = q.data?.filter(
    (d) =>
      JSON.stringify(d).toLowerCase().includes(search.toLowerCase()) &&
      (!region || d.region === region) &&
      (!category ||
        d.items.some((i) =>
          i.name.toLowerCase().includes(category.toLowerCase()),
        )) &&
      (!budget || (d.budget != null && Number(d.budget) <= Number(budget))) &&
      (!source || d.data_type === source) &&
      (!deadline ||
        (!!d.deadline &&
          d.deadline.split(".").reverse().join("-") <= deadline)) &&
      (!status || aq.data?.find((a) => a.id === d.id)?.decision === status),
  );
  return (
    <>
      <PageHeading
        title={t("Возможности закупок", "Сатып алу мүмкіндіктері")}
        subtitle={t(
          "Поиск по импортированным документам и учебным примерам.",
          "Импортталған құжаттар мен оқу мысалдары бойынша іздеу.",
        )}
      />
      <div className="notice">
        <Compass size={20} />
        <div>
          <strong>
            {t(
              "Подключение к порталам не настроено",
              "Порталдарға қосылу бапталмаған",
            )}
          </strong>
          <p>
            {t(
              "Goszakup и Самрук-Қазына здесь не подключены. Все записи явно помечены источником.",
              "Goszakup және Самұрық-Қазына қосылмаған. Әр жазбаның дереккөзі көрсетілген.",
            )}
          </p>
        </div>
      </div>
      <div className="filter-grid">
        <label className="field search-field">
          {t("Поиск", "Іздеу")}
          <span>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "Название, товар, заказчик",
                "Атауы, тауар, тапсырыс беруші",
              )}
            />
          </span>
        </label>
        <label className="field">
          {t("Регион", "Өңір")}
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t("Все регионы", "Барлық өңірлер")}</option>
            {[...new Set(q.data?.map((d) => d.region).filter(Boolean))].map(
              (r) => (
                <option key={r} value={r!}>
                  {r}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          {t("Категория / товар", "Санат / тауар")}
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label className="field">
          {t("Бюджет до, ₸", "Бюджет шегі, ₸")}
          <input
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        <label className="field">
          {t("Срок подачи до", "Өтінім мерзімі шегі")}
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        <label className="field">
          {t("Источник", "Дереккөз")}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{t("Все источники", "Барлық дереккөздер")}</option>
            <option value="synthetic">
              {t("Учебные примеры", "Оқу мысалдары")}
            </option>
            <option value="imported">
              {t("Импортированные", "Импортталған")}
            </option>
          </select>
        </label>
        <label className="field">
          {t("Решение анализа", "Талдау шешімі")}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("Все решения", "Барлық шешімдер")}</option>
            <option value="REQUIRES_ATTENTION">
              {t("Требует внимания", "Назар аудару қажет")}
            </option>
            <option value="NOT_FEASIBLE">
              {t("Невыполним", "Орындалмайды")}
            </option>
            <option value="READY_FOR_REVIEW">
              {t("Готов к проверке", "Тексеруге дайын")}
            </option>
          </select>
        </label>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Закупка", "Сатып алу")}</th>
                  <th>{t("Источник", "Дереккөз")}</th>
                  <th>{t("Бюджет", "Бюджет")}</th>
                  <th>{t("Срок", "Мерзім")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.title}</strong>
                      <small>
                        {d.region || t("Не указано", "Көрсетілмеген")}
                      </small>
                    </td>
                    <td>
                      <span
                        className={
                          "tag " +
                          (d.data_type === "synthetic"
                            ? "tag-amber"
                            : "tag-blue")
                        }
                      >
                        {d.data_type === "synthetic"
                          ? t("Учебный пример", "Оқу мысалы")
                          : t("Импорт", "Импорт")}
                      </span>
                    </td>
                    <td className="number-cell">{kzt(d.budget)}</td>
                    <td>{d.deadline || "—"}</td>
                    <td>
                      <Button asChild variant="ghost">
                        <Link
                          href={
                            ["enamel", "brushes", "buckets"].includes(d.id)
                              ? "/demo"
                              : "/analyses/" + d.id
                          }
                        >
                          {t("Открыть", "Ашу")}
                          <ArrowUpRight size={15} />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.length && (
              <p className="panel-empty">
                {t(
                  "Нет результатов. Измените фильтры.",
                  "Нәтиже жоқ. Сүзгілерді өзгертіңіз.",
                )}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
