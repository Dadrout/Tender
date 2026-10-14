"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ScanLine,
  Boxes,
  Compass,
  FileText,
  FlaskConical,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  ShieldCheck,
  ChartNoAxesCombined,
  FileSearch,
  Check,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { useLocale } from "@/lib/context";
import { api, kzt, date } from "@/lib/api";
import { Analysis, Discovery } from "@/lib/types";
import { Button } from "./ui/button";
import { Dashboard, Demo, DiscoveryPage, Reports } from "./overview";
import { NewAnalysis } from "./upload";
import { AnalysisWorkspace } from "./analysis";
import { Inventory } from "./inventory";
import { Empty } from "./shared";

function Logo() {
  return (
    <Link className="logo" href="/">
      <span className="logo-symbol">
        <ScanLine size={22} />
      </span>
      <span>
        QazBid <b>AI</b>
      </span>
    </Link>
  );
}
export function Preferences() {
  const { locale, setLocale, t, dark, setDark } = useLocale();
  return (
    <div className="preferences">
      <div className="language-control">
        <button
          className={locale === "ru" ? "active" : ""}
          onClick={() => setLocale("ru")}
          aria-label="Русский"
        >
          RU
        </button>
        <button
          className={locale === "kk" ? "active" : ""}
          onClick={() => setLocale("kk")}
          aria-label="Қазақша"
        >
          KZ
        </button>
      </div>
      <button
        className="icon-button"
        onClick={() => setDark(!dark)}
        aria-label={t("Сменить тему", "Тақырыпты өзгерту")}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
export function Application() {
  const path = usePathname();
  const { t } = useLocale();
  const [menu, setMenu] = useState(false);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () =>
      api<{ status: string; gemini_available: boolean }>("/health"),
    retry: 1,
  });
  if (path === "/") return <Landing />;
  const nav = [
    { href: "/dashboard", label: t("Обзор", "Шолу"), icon: LayoutDashboard },
    { href: "/new", label: t("Новый анализ", "Жаңа талдау"), icon: Plus },
    {
      href: "/discovery",
      label: t("Возможности", "Мүмкіндіктер"),
      icon: Compass,
    },
    {
      href: "/inventory",
      label: t("Мой каталог", "Менің каталогым"),
      icon: Boxes,
    },
    { href: "/reports", label: t("Отчёты", "Есептер"), icon: FileText },
    {
      href: "/demo",
      label: t("Демонстрация", "Демонстрация"),
      icon: FlaskConical,
    },
  ];
  const selected = path.startsWith("/analyses/")
    ? t("Рабочее пространство анализа", "Талдау жұмыс кеңістігі")
    : nav.find((n) => n.href === path)?.label;
  let view: React.ReactNode;
  if (path === "/dashboard") view = <Dashboard />;
  else if (path === "/new") view = <NewAnalysis />;
  else if (path === "/inventory") view = <Inventory />;
  else if (path === "/reports") view = <Reports />;
  else if (path === "/discovery") view = <DiscoveryPage />;
  else if (path === "/demo") view = <Demo />;
  else if (path.startsWith("/analyses/"))
    view = <AnalysisWorkspace id={path.split("/")[2]} />;
  else
    view = (
      <Empty
        title={t("Страница не найдена", "Бет табылмады")}
        description={t(
          "Перейдите к обзору анализов.",
          "Талдаулар шолуына өтіңіз.",
        )}
        action={
          <Button asChild>
            <Link href="/dashboard">{t("Открыть обзор", "Шолуды ашу")}</Link>
          </Button>
        }
      />
    );
  return (
    <div className="app-layout">
      <aside className={"sidebar " + (menu ? "is-open" : "")}>
        <div className="sidebar-top">
          <Logo />
          <button
            className="icon-button mobile-only"
            onClick={() => setMenu(false)}
            aria-label={t("Закрыть меню", "Мәзірді жабу")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="organization">
          <div className="org-avatar">TS</div>
          <div>
            <strong>{t("Моя компания", "Менің компаниям")}</strong>
            <small>{t("Тараз · Казахстан", "Тараз · Қазақстан")}</small>
          </div>
        </div>
        <div className="nav-label">
          {t("РАБОЧЕЕ ПРОСТРАНСТВО", "ЖҰМЫС КЕҢІСТІГІ")}
        </div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenu(false)}
              className={
                path === n.href ||
                (n.href === "/dashboard" && path.startsWith("/analyses/"))
                  ? "selected"
                  : ""
              }
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.href === "/new" && <span className="nav-key">N</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <strong>{t("Решения с доказательствами", "Дәлелді шешімдер")}</strong>
          <p>
            {t(
              "Каждый вывод связан с документом, каталогом или вашим допущением.",
              "Әр қорытынды құжатпен, каталогпен немесе сіздің болжамыңызбен байланысты.",
            )}
          </p>
        </div>
        <div className="sidebar-bottom">
          <span
            className={"connection-dot " + (health.isError ? "offline" : "")}
          />
          {health.isError
            ? t("Сервер недоступен", "Сервер қолжетімсіз")
            : t("Локальное пространство", "Жергілікті кеңістік")}
          <small>QazBid AI · MVP</small>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          onClick={() => setMenu(false)}
          aria-label={t("Закрыть меню", "Мәзірді жабу")}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              onClick={() => setMenu(true)}
              aria-label={t("Открыть меню", "Мәзірді ашу")}
            >
              <Menu size={21} />
            </button>
            <span>QazBid AI</span>
            <ChevronRight size={14} />
            <strong>{selected}</strong>
          </div>
          <Preferences />
        </header>
        <main className="main-content">{view}</main>
        <footer className="app-footer">
          <span>
            {t(
              "Для поддержки решений. Окончательную проверку проводит специалист.",
              "Шешім қабылдауға көмек. Қорытынды тексеруді маман жүргізеді.",
            )}
          </span>
          <span>₸ KZT · UTC+5</span>
        </footer>
      </div>
    </div>
  );
}
function Landing() {
  const { t, locale } = useLocale();
  const discovery = useQuery({
    queryKey: ["discovery"],
    queryFn: () => api<Discovery[]>("/discovery"),
  });
  const analyses = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api<Analysis[]>("/analyses"),
  });
  const sample = discovery.data?.find((a) => a.id === "enamel");
  const saved = analyses.data?.find(
    (a) => a.synthetic && a.state === "completed",
  );
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <nav className="landing-links">
          <a href="#workflow">{t("Как это работает", "Қалай жұмыс істейді")}</a>
          <Link href="/dashboard">
            {t("Рабочее пространство", "Жұмыс кеңістігі")}
          </Link>
        </nav>
        <Preferences />
        <Button asChild variant="secondary">
          <Link href="/dashboard">
            {t("Открыть приложение", "Қолданбаны ашу")}
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />
              {t(
                "ТЕНДЕРНАЯ АНАЛИТИКА ДЛЯ БИЗНЕСА КАЗАХСТАНА",
                "ҚАЗАҚСТАН БИЗНЕСІНЕ АРНАЛҒАН ТЕНДЕРЛІК ТАЛДАУ",
              )}
            </div>
            <h1>
              {t(
                "Госзакупки под контролем искусственного интеллекта",
                "Мемлекеттік сатып алу жасанды интеллект бақылауында",
              )}
            </h1>
            <p>
              {t(
                "Находите возможности, проверяйте технические требования, оценивайте риски и рассчитывайте прибыль до участия в тендере.",
                "Мүмкіндіктерді табыңыз, техникалық талаптарды тексеріңіз, тәуекелдерді бағалаңыз және тендерге қатыспас бұрын пайданы есептеңіз.",
              )}
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/new">
                  {t("Анализировать тендер", "Тендерді талдау")}
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/demo">
                  <FlaskConical size={17} />
                  {t("Открыть демо", "Демоны ашу")}
                </Link>
              </Button>
            </div>
            <div className="hero-foot">
              <span>
                <Check size={15} />
                {t("PDF + Excel", "PDF + Excel")}
              </span>
              <span>
                <Check size={15} />
                {t("Работает без API-ключа", "API кілтінсіз жұмыс істейді")}
              </span>
              <span>
                <Check size={15} />
                {t("Русский / Қазақша", "Русский / Қазақша")}
              </span>
            </div>
          </div>
          <div className="hero-product">
            <div className="preview-top">
              <span>
                <ScanLine size={16} />
                {t("Досье закупки", "Сатып алу досьесі")}
              </span>
              <span className="tag tag-blue">
                {t("Учебный пример", "Оқу мысалы")}
              </span>
            </div>
            <div className="preview-body">
              <div className="eyebrow">DEMO · TARAZ</div>
              <h2>
                {sample?.title ||
                  t("От спецификации к решению", "Спецификациядан шешімге")}
              </h2>
              <p className="muted">
                <MapPin size={14} />
                {sample?.region ||
                  t("Тараз, Жамбылская область", "Тараз, Жамбыл облысы")}
              </p>
              <div className="preview-budget">
                <small>{t("Бюджет из документа", "Құжаттағы бюджет")}</small>
                <strong>{kzt(sample?.budget, locale)}</strong>
              </div>
              <div className="preview-requirement">
                <FileSearch size={20} />
                <div>
                  <strong>
                    {sample?.items[0]?.name ||
                      t("Требование из PDF", "PDF талабы")}
                  </strong>
                  <span>
                    {sample
                      ? `${sample.items[0]?.quantity} ${sample.items[0]?.unit} · ${sample.items[0]?.requirements.find((r) => r.key === "volume")?.value}`
                      : t(
                          "Постраничные ссылки и исходные значения",
                          "Бет сілтемелері және бастапқы мәндер",
                        )}
                  </span>
                </div>
                <span className="source-tag">PDF · 1</span>
              </div>
              {saved?.financial ? (
                <div className="preview-results">
                  <div>
                    <small>{t("Расчётная прибыль", "Есептік пайда")}</small>
                    <strong>{kzt(saved.financial.profit, locale)}</strong>
                  </div>
                  <div>
                    <small>{t("Дозакупка", "Қосымша сатып алу")}</small>
                    <strong>
                      {saved.financial.missing_units} {t("ед.", "бірл.")}
                    </strong>
                  </div>
                  <div>
                    <small>{t("Риски", "Тәуекелдер")}</small>
                    <strong>{saved.risks?.length}</strong>
                  </div>
                </div>
              ) : (
                <div className="preview-note">
                  <ShieldCheck size={19} />
                  <p>
                    {t(
                      "Демо читает этот PDF и каталог из 17 товаров. Запустите обработку, чтобы увидеть реальный расчёт.",
                      "Демо осы PDF пен 17 тауар каталогын оқиды. Нақты есепті көру үшін өңдеуді іске қосыңыз.",
                    )}
                  </p>
                </div>
              )}
              <Button asChild variant="secondary" className="full-width">
                <Link href={saved ? "/analyses/" + saved.id : "/demo"}>
                  {saved
                    ? t("Посмотреть анализ", "Талдауды көру")
                    : t(
                        "Проверить на реальных файлах",
                        "Нақты файлдарда тексеру",
                      )}
                  <ArrowUpRight size={16} />
                </Link>
              </Button>
            </div>
            <div className="preview-bottom">
              <span className="connection-dot" />
              {t(
                "Локальная обработка · без выдуманных данных",
                "Жергілікті өңдеу · ойдан шығарылған дерексіз",
              )}
            </div>
          </div>
        </section>
        <section className="value-section">
          <div className="value-item">
            <FileSearch size={25} />
            <h3>{t("Требования без догадок", "Болжамсыз талаптар")}</h3>
            <p>
              {t(
                "Размеры, количество и документы — с цитатами и страницами технической спецификации.",
                "Өлшемдер, сан және құжаттар — техникалық спецификацияның дәйексөздерімен және беттерімен.",
              )}
            </p>
          </div>
          <div className="value-item">
            <Boxes size={25} />
            <h3>
              {t(
                "Запасы с проверкой совместимости",
                "Сәйкестігі тексерілген қор",
              )}
            </h3>
            <p>
              {t(
                "Сопоставление по характеристикам. Похожее название ещё не подтверждает соответствие.",
                "Сипаттамалар бойынша салыстыру. Ұқсас атау сәйкестікті растамайды.",
              )}
            </p>
          </div>
          <div className="value-item">
            <ChartNoAxesCombined size={25} />
            <h3>{t("Прибыль и деньги отдельно", "Пайда мен қаражат бөлек")}</h3>
            <p>
              {t(
                "Учёт стоимости запасов, дозакупки, доставки и денег до оплаты заказчиком.",
                "Қор құны, қосымша сатып алу, жеткізу және тапсырыс беруші төлеміне дейінгі қаражат.",
              )}
            </p>
          </div>
        </section>
        <section className="workflow-section" id="workflow">
          <div>
            <div className="eyebrow">
              {t("ВАШ РАБОЧИЙ ПРОЦЕСС", "СІЗДІҢ ЖҰМЫС ҮДЕРІСІҢІЗ")}
            </div>
            <h2>
              {t(
                "Два документа. Одно ясное решение.",
                "Екі құжат. Бір айқын шешім.",
              )}
            </h2>
            <p>
              {t(
                "От загрузки файлов до отчёта для вашей команды.",
                "Файлдарды жүктеуден командаңызға арналған есепке дейін.",
              )}
            </p>
          </div>
          <ol>
            {[
              [
                t("Загрузите PDF и Excel", "PDF және Excel жүктеңіз"),
                t(
                  "Спецификация и ваш каталог",
                  "Спецификация және каталогыңыз",
                ),
              ],
              [
                t("Проверьте требования", "Талаптарды тексеріңіз"),
                t(
                  "Исправьте извлечённые данные",
                  "Алынған деректерді түзетіңіз",
                ),
              ],
              [
                t("Оцените риски и прибыль", "Тәуекел мен пайданы бағалаңыз"),
                t(
                  "Меняйте предположения в симуляторе",
                  "Симуляторда болжамдарды өзгертіңіз",
                ),
              ],
              [
                t("Скачайте отчёт", "Есепті жүктеңіз"),
                t(
                  "Матрица, финансы и следующие действия",
                  "Матрица, қаржы және келесі әрекеттер",
                ),
              ],
            ].map(([a, b], i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{a}</strong>
                  <p>{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>
          {t(
            "Интеллект для закупок. Контроль остаётся у вас.",
            "Сатып алуға арналған интеллект. Бақылау өзіңізде.",
          )}
        </p>
        <Link href="/demo">
          {t("Открыть демо", "Демоны ашу")}
          <ArrowUpRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
