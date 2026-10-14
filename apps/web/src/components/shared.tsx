"use client";
import {
  AlertTriangle,
  Check,
  HelpCircle,
  MinusCircle,
  ArrowUpRight,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";
import { useLocale } from "@/lib/context";
import { Button } from "./ui/button";
import { Status, Analysis } from "@/lib/types";
import { kzt } from "@/lib/api";
export function StatusBadge({ status }: { status: Status }) {
  const { t } = useLocale();
  const labels = {
    VERIFIED_MATCH: t("Совпадает", "Сәйкес"),
    CONFLICT: t("Конфликт", "Қайшылық"),
    PARTIAL_MATCH: t("Частично", "Ішінара"),
    UNKNOWN: t("Нет сведений", "Дерек жоқ"),
  };
  const Icon = {
    VERIFIED_MATCH: Check,
    CONFLICT: MinusCircle,
    PARTIAL_MATCH: AlertTriangle,
    UNKNOWN: HelpCircle,
  }[status];
  return (
    <span className={"status status-" + status}>
      <Icon size={13} />
      {labels[status]}
    </span>
  );
}
export function DecisionBadge({ a }: { a: Analysis }) {
  const { t } = useLocale();
  const labels = {
    READY_FOR_REVIEW: t("Готов к проверке", "Тексеруге дайын"),
    REQUIRES_ATTENTION: t("Требует внимания", "Назар аудару қажет"),
    NOT_FEASIBLE: t(
      "Невыполним при текущих допущениях",
      "Ағымдағы болжамдарда орындалмайды",
    ),
  };
  return (
    <span className={"decision-badge " + (a.decision || "review")}>
      {a.decision
        ? labels[a.decision]
        : t("Проверка документа", "Құжатты тексеру")}
    </span>
  );
}
export function Loading() {
  const { t } = useLocale();
  return (
    <div aria-busy="true" className="loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-metrics" />
      <div className="skeleton skeleton-table" />
      <span className="loading-label">
        <LoaderCircle size={16} className="spin" />
        {t("Загрузка данных", "Деректер жүктелуде")}
      </span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="error-box" role="alert">
      <AlertTriangle size={20} />
      <div>
        <strong>
          {t(
            "Не удалось выполнить действие",
            "Әрекетті орындау мүмкін болмады",
          )}
        </strong>
        <p>
          {error?.message ||
            t(
              "Проверьте подключение к backend",
              "Backend байланысын тексеріңіз",
            )}
        </p>
        {retry && (
          <Button variant="secondary" onClick={retry}>
            <RefreshCw size={16} />
            {t("Повторить", "Қайталау")}
          </Button>
        )}
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Metric({
  label,
  value,
  foot,
  tone,
}: {
  label: string;
  value: string;
  foot?: string;
  tone?: string;
}) {
  return (
    <div className={"metric " + (tone || "")}>
      <span>{label}</span>
      <strong>{value}</strong>
      {foot && <small>{foot}</small>}
    </div>
  );
}
export function FinanceMetrics({ a }: { a: Analysis }) {
  const { t, locale } = useLocale();
  const f = a.financial!;
  return (
    <div className="metric-grid">
      <Metric
        label={t("Цена предложения", "Ұсыныс бағасы")}
        value={kzt(f.revenue, locale)}
        foot={t("Ваше предложение заказчику", "Тапсырыс берушіге ұсыныс")}
      />
      <Metric
        label={t("Расчётная прибыль", "Есептік пайда")}
        value={kzt(f.profit, locale)}
        tone={Number(f.profit) < 0 ? "negative" : "positive"}
        foot={
          f.complete
            ? t("С учётом стоимости запасов", "Қор құнын ескере отырып")
            : t("Недостаточно данных о стоимости", "Құн деректері жеткіліксіз")
        }
      />
      <Metric
        label={t("Маржа", "Маржа")}
        value={f.margin == null ? "—" : Number(f.margin).toFixed(1) + "%"}
        foot={t("Прибыль / выручка", "Пайда / түсім")}
      />
      <Metric
        label={t("Нужно дополнительных денег", "Қосымша қаражат қажет")}
        value={kzt(f.incremental_cash, locale)}
        foot={t(
          "Закупка, расходы и резервы",
          "Сатып алу, шығындар және резервтер",
        )}
      />
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <ArrowUpRight size={26} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
