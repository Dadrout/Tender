"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  RefreshCw,
  MapPin,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { BrandIcon } from "./brand";
import { api, kzt, date } from "@/lib/api";
import { useLocale } from "@/lib/context";
import {
  Catalog,
  Opportunity,
  RadarResponse,
  SourceProvenance,
} from "@/lib/types";
import { Button } from "./ui/button";
import { Empty, ErrorState, Loading, StatusBadge } from "./shared";

export function ProvenanceNotice({
  source,
}: {
  source?: SourceProvenance | null;
}) {
  const { t } = useLocale();
  if (!source?.historical) return null;
  return (
    <aside className="notice provenance-notice">
      <BrandIcon name="tender-document" size={20} />
      <div>
        <strong>
          {t("Исторический публичный документ", "Тарихи ашық құжат")}
        </strong>
        <p>
          {source.label || source.title} ·{" "}
          {t(
            "Текущий статус закупки не проверен. Это не предложение участвовать сейчас.",
            "Сатып алудың ағымдағы күйі тексерілмеген. Бұл қазір қатысуға ұсыныс емес.",
          )}
        </p>
        {source.source_url && (
          <a
            className="text-link"
            href={source.source_url}
            target="_blank"
            rel="noreferrer"
          >
            {t("Официальный источник", "Ресми дереккөз")}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
    </aside>
  );
}

export function OpportunityRadar() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const client = useQueryClient();
  const [catalogId, setCatalogId] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(true);
  const [kind, setKind] = useState("");
  const catalogs = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => api<Catalog[]>("/catalogs"),
  });
  const selected = catalogId || catalogs.data?.[0]?.id || "";
  const q = useQuery({
    queryKey: ["radar", selected],
    queryFn: () =>
      api<RadarResponse>("/radar?catalog_id=" + encodeURIComponent(selected)),
    enabled: !!selected,
    staleTime: 0,
  });
  const open = useMutation({
    mutationFn: ({
      sourceId,
      catalog,
    }: {
      sourceId: string;
      catalog: string;
    }) =>
      api<{ analysis_id: string }>("/radar/analyze", {
        method: "POST",
        body: JSON.stringify({ source_id: sourceId, catalog_id: catalog }),
      }),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ["analyses"] });
      router.push("/analyses/" + result.analysis_id);
    },
  });
  if (catalogs.isLoading) return <Loading />;
  if (catalogs.isError)
    return (
      <ErrorState error={catalogs.error} retry={() => catalogs.refetch()} />
    );
  if (!catalogs.data?.length)
    return (
      <Empty
        title={t(
          "Добавьте каталог для подбора",
          "Іріктеу үшін каталог қосыңыз",
        )}
        description={t(
          "Импортируйте Excel или CSV с товарами. Радар сопоставит его с доступными документами.",
          "Тауарлары бар Excel немесе CSV импорттаңыз. Радар оны қолжетімді құжаттармен салыстырады.",
        )}
        action={
          <Button asChild>
            <Link href="/inventory">
              {t("Открыть каталог", "Каталогты ашу")}
              <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
    );
  const rows =
    q.data?.opportunities.filter(
      (o) =>
        (!onlyMatches || o.relevant) &&
        (!kind || o.provenance.data_type === kind),
    ) || [];
  const decisions = {
    READY_FOR_REVIEW: t("Готов к проверке", "Тексеруге дайын"),
    REQUIRES_ATTENTION: t("Требует внимания", "Назар аудару қажет"),
    NOT_FEASIBLE: t("Есть препятствия", "Кедергілер бар"),
  };
  return (
    <section className="radar-workspace" aria-labelledby="radar-heading">
      <div className="radar-heading">
        <div>
          <span className="eyebrow">QAZBID INTELLIGENCE</span>
          <h2 id="radar-heading">
            <BrandIcon name="product-match" size={23} />
            {t("Подбор по каталогу", "Каталог бойынша іріктеу")}
          </h2>
          <p>
            {t(
              "Один каталог → подходящие документы → проверка требований → решение.",
              "Бір каталог → сәйкес құжаттар → талаптарды тексеру → шешім.",
            )}
          </p>
        </div>
        <span className="tag">
          {t(
            "Локальная подборка · не онлайн-сканирование",
            "Жергілікті жинақ · онлайн сканерлеу емес",
          )}
        </span>
      </div>
      <div className="panel radar-controls">
        <label className="field">
          {t("Каталог для подбора", "Іріктеу каталогы")}
          <select
            value={selected}
            onChange={(e) => {
              setCatalogId(e.target.value);
              open.reset();
            }}
          >
            {catalogs.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.count} {t("товаров", "тауар")}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("Тип документов", "Құжат түрі")}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t("Все документы", "Барлық құжаттар")}</option>
            <option value="historical">
              {t("Публичные исторические", "Ашық тарихи құжаттар")}
            </option>
            <option value="imported">
              {t("Ваши импорты", "Сіздің импорттарыңыз")}
            </option>
            <option value="synthetic">
              {t("Учебные примеры", "Оқу мысалдары")}
            </option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={onlyMatches}
            onChange={(e) => setOnlyMatches(e.target.checked)}
          />
          {t("Только с совпадениями", "Тек сәйкестіктер")}
        </label>
        <Button
          variant="secondary"
          onClick={() => q.refetch()}
          disabled={q.isFetching || open.isPending}
        >
          <RefreshCw
            size={15}
            className={q.isFetching ? "spin" : ""}
            aria-hidden="true"
          />
          {t("Обновить подбор", "Іріктеуді жаңарту")}
        </Button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        q.data && (
          <>
            <div className="radar-stats" aria-live="polite">
              <div>
                <strong>{q.data.stats.evaluated}</strong>
                <span>{t("Документов оценено", "Бағаланған құжаттар")}</span>
              </div>
              <div>
                <strong>{q.data.stats.candidates}</strong>
                <span>
                  {t("С совпадениями в каталоге", "Каталогпен сәйкестіктер")}
                </span>
              </div>
              <div>
                <strong>{q.data.stats.historical}</strong>
                <span>
                  {t("Публичных исторических", "Ашық тарихи құжаттар")}
                </span>
              </div>
              <div>
                <strong>{q.data.stats.synthetic}</strong>
                <span>{t("Учебных примеров", "Оқу мысалдары")}</span>
              </div>
            </div>
            <p className="form-note">
              {t(
                "Сначала показываем документы с большим покрытием позиций каталогом, затем — с меньшим числом конфликтов и неизвестных требований. Это не вероятность победы. Счётчики относятся ко всей доступной подборке; повторные одинаковые импорты объединены.",
                "Алдымен каталогпен қамтылған позициялары көп, кейін қайшылықтары мен белгісіз талаптары аз құжаттар көрсетіледі. Бұл жеңіс ықтималдығы емес. Есептегіштер бүкіл жинаққа қатысты; бірдей импорттар біріктірілген.",
              )}
            </p>
            {!!q.data.warnings.length && (
              <details className="radar-warnings">
                <summary>
                  {t(
                    "Недоступные документы и ограничения",
                    "Қолжетімсіз құжаттар мен шектеулер",
                  )}{" "}
                  ({q.data.warnings.length})
                </summary>
                <ul>
                  {q.data.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            {open.isError && <ErrorState error={open.error} />}
            {!rows.length ? (
              <Empty
                title={t(
                  "Нет совпадений с каталогом",
                  "Каталогпен сәйкестік жоқ",
                )}
                description={t(
                  "Выберите другой каталог, измените тип документов или отключите «Только с совпадениями», чтобы просмотреть всю подборку.",
                  "Басқа каталогты таңдаңыз, құжат түрін өзгертіңіз немесе барлық жинақты көру үшін «Тек сәйкестіктерді» өшіріңіз.",
                )}
              />
            ) : (
              <div className="radar-grid">
                {rows.map((o) => (
                  <article
                    className="panel opportunity-card"
                    data-testid={"radar-" + o.source_id.replace(":", "-")}
                    key={o.source_id}
                  >
                    <div className="opportunity-top">
                      <span
                        className={
                          "tag " +
                          (o.provenance.data_type === "synthetic"
                            ? "tag-amber"
                            : "tag-blue")
                        }
                      >
                        {o.provenance.data_type === "historical"
                          ? t("Исторический документ", "Тарихи құжат")
                          : o.provenance.data_type === "synthetic"
                            ? t("Учебный пример", "Оқу мысалы")
                            : t("Ваш импорт", "Сіздің импортыңыз")}
                      </span>
                      <span className={"decision-badge " + o.decision}>
                        {decisions[o.decision]}
                      </span>
                    </div>
                    <h3>{o.provenance.title || o.title}</h3>
                    <p className="opportunity-location">
                      <MapPin size={14} aria-hidden="true" />
                      {o.region || t("Регион не указан", "Өңір көрсетілмеген")}
                    </p>
                    {o.provenance.historical && (
                      <p className="historical-note">
                        {o.provenance.label} ·{" "}
                        {t(
                          "Текущий статус не проверен",
                          "Ағымдағы күйі тексерілмеген",
                        )}
                      </p>
                    )}
                    <div className="opportunity-finance">
                      <div>
                        <span>{t("Бюджет документа", "Құжат бюджеті")}</span>
                        <strong>{kzt(o.budget, locale)}</strong>
                      </div>
                      <div>
                        <span>
                          {t("Прибыль в сценарии", "Сценарийдегі пайда")}
                        </span>
                        <strong
                          data-testid="radar-profit"
                          className={
                            Number(o.financial.profit) < 0
                              ? "negative"
                              : o.financial.profit
                                ? "positive"
                                : ""
                          }
                        >
                          {kzt(o.financial.profit, locale)}
                        </strong>
                      </div>
                    </div>
                    <div className="opportunity-signals">
                      <span>
                        <BrandIcon name="catalog" size={15} />
                        {o.matched_items}/{o.total_items}{" "}
                        {t("позиций с кандидатом", "үміткері бар позиция")}
                      </span>
                      <span>
                        <AlertTriangle size={15} aria-hidden="true" />
                        {o.critical_conflicts}{" "}
                        {t("критичных конфликтов", "сыни қайшылық")}
                      </span>
                      <span>
                        {o.unknown_requirements}{" "}
                        {t("неподтверждённых требований", "расталмаған талап")}
                      </span>
                    </div>
                    <p className="opportunity-estimate-note">
                      {o.estimate_unavailable_reason ||
                        t(
                          "Предложение равно бюджету; доставка, упаковка, налоговый резерв и финансирование — 0. Уточните расходы в симуляторе.",
                          "Ұсыныс бюджетке тең; жеткізу, орау, салық резерві мен қаржыландыру — 0. Шығындарды симуляторда нақтылаңыз.",
                        )}
                    </p>
                    <details>
                      <summary>
                        {t(
                          "Почему показана эта закупка",
                          "Бұл сатып алу неге көрсетілген",
                        )}
                      </summary>
                      <p className="form-note">
                        {o.relevant
                          ? t(
                              "Найдены товары-кандидаты. Совпадение названия не подтверждает все характеристики.",
                              "Үміткер тауарлар табылды. Атаудың сәйкес келуі барлық сипаттаманы растамайды.",
                            )
                          : t(
                              "Подходящих товаров-кандидатов не найдено.",
                              "Сәйкес үміткер тауарлар табылмады.",
                            )}
                      </p>
                      {o.evidence.slice(0, 3).map((e) => (
                        <div className="radar-evidence" key={e.id}>
                          <StatusBadge status={e.status} />
                          <strong>{e.property}</strong>
                          <p>
                            {t("Нужно", "Қажет")}: {e.required || "—"} ·{" "}
                            {t("Каталог", "Каталог")}: {e.actual || "—"}
                          </p>
                          <small>
                            {t("Страница", "Бет")} {e.page} ·{" "}
                            {t("Строка каталога", "Каталог жолы")}{" "}
                            {e.row || "—"}
                          </small>
                          <blockquote>{e.requirement}</blockquote>
                        </div>
                      ))}
                      {!!o.blockers.length && (
                        <p className="form-note">
                          {t("Следующий шаг", "Келесі қадам")}:{" "}
                          {o.blockers[0].action}
                        </p>
                      )}
                    </details>
                    <div className="opportunity-actions">
                      <Button
                        onClick={() =>
                          open.mutate({
                            sourceId: o.source_id,
                            catalog: selected,
                          })
                        }
                        disabled={open.isPending}
                      >
                        {open.isPending &&
                        open.variables?.sourceId === o.source_id
                          ? t("Открываем…", "Ашылуда…")
                          : t("Проверить требования", "Талаптарды тексеру")}
                        <ArrowRight size={15} aria-hidden="true" />
                      </Button>
                      <a
                        className="text-link"
                        href={
                          "/api/radar/source?source_id=" +
                          encodeURIComponent(o.source_id)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("Исходный PDF", "Бастапқы PDF")}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </div>
                    {o.provenance.source_url && (
                      <a
                        className="text-link official-source"
                        href={o.provenance.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("Официальный источник", "Ресми дереккөз")}
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                    {o.provenance.retrieved_at && (
                      <small className="muted">
                        {t("Документ получен", "Құжат алынды")}:{" "}
                        {date(o.provenance.retrieved_at)}
                      </small>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
