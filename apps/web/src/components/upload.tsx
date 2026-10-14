"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Check,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/context";
import { Catalog, Job } from "@/lib/types";
import { Button } from "./ui/button";
import { PageHeading, ErrorState } from "./shared";
import { Processing } from "./overview";

export function FileDrop({
  kind,
  file,
  onFile,
}: {
  kind: "tender" | "inventory";
  file: File | null;
  onFile: (f: File) => void;
}) {
  const { t } = useLocale();
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const tender = kind === "tender";
  function pick(f?: File) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!(tender ? ["pdf"] : ["xlsx", "xls", "csv"]).includes(ext || "")) {
      setError(
        t("Неподдерживаемый формат файла", "Файл пішімі қолдау көрсетілмейді"),
      );
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError(t("Файл превышает 15 МБ", "Файл 15 МБ-тан асады"));
      return;
    }
    if (!f.size) {
      setError(t("Файл пуст", "Файл бос"));
      return;
    }
    setError("");
    onFile(f);
  }
  return (
    <div>
      <label
        className={
          "file-drop " + (file ? "has-file" : "") + (over ? " drag-over" : "")
        }
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        <input
          data-testid={kind + "-file"}
          type="file"
          accept={tender ? ".pdf" : ".xlsx,.xls,.csv"}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div className="file-icon">
          {file ? (
            <Check size={25} />
          ) : tender ? (
            <FileText size={25} />
          ) : (
            <FileSpreadsheet size={25} />
          )}
        </div>
        <strong>
          {file
            ? file.name
            : tender
              ? t(
                  "Перетащите техническую спецификацию",
                  "Техникалық спецификацияны сүйреңіз",
                )
              : t("Перетащите каталог товаров", "Тауар каталогын сүйреңіз")}
        </strong>
        <span>
          {file
            ? `${(file.size / 1024).toFixed(0)} KB · ` +
              t("Нажмите, чтобы заменить", "Ауыстыру үшін басыңыз")
            : t(
                "или нажмите для выбора файла",
                "немесе файл таңдау үшін басыңыз",
              )}
        </span>
        <small>
          {tender ? "PDF" : "XLSX, XLS, CSV"} · {t("до 15 МБ", "15 МБ дейін")}
        </small>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function NewAnalysis() {
  const { t } = useLocale();
  const router = useRouter();
  const client = useQueryClient();
  const [pdf, setPdf] = useState<File | null>(null);
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [cid, setCid] = useState("");
  const [mode, setMode] = useState("deterministic");
  const [jid, setJid] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    headers: string[];
    mapping: Record<string, string>;
    rows: Record<string, string>[];
  } | null>(null);
  const catalogs = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => api<Catalog[]>("/catalogs"),
  });
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ gemini_available: boolean }>("/health"),
  });
  const inspect = useMutation({
    mutationFn: (f: File) => {
      const d = new FormData();
      d.set("file", f);
      return api<{
        headers: string[];
        mapping: Record<string, string>;
        rows: Record<string, string>[];
      }>("/catalogs/preview", { method: "POST", body: d });
    },
    onSuccess: (p) => {
      setPreview(p);
      setMapping(p.mapping);
    },
  });
  const upload = useMutation({
    mutationFn: () => {
      const f = new FormData();
      f.set("tender", pdf!);
      f.set("mode", mode);
      if (cid) f.set("catalog_id", cid);
      else {
        f.set("inventory", xlsx!);
        if (preview)
          f.set(
            "mapping",
            JSON.stringify(
              Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)),
            ),
          );
      }
      return api<Job>("/jobs", { method: "POST", body: f });
    },
    onSuccess: (j) => setJid(j.id),
  });
  const job = useQuery({
    queryKey: ["job", jid],
    queryFn: () => api<Job>("/jobs/" + jid),
    enabled: !!jid,
    refetchInterval: (q) =>
      ["review_ready", "completed", "failed"].includes(
        q.state.data?.status || "",
      )
        ? false
        : 800,
  });
  useEffect(() => {
    if (
      job.data?.status === "review_ready" ||
      job.data?.status === "completed"
    ) {
      client.invalidateQueries({ queryKey: ["catalogs"] });
      client.invalidateQueries({ queryKey: ["analyses"] });
      router.push("/analyses/" + job.data.analysis_id);
    }
  }, [job.data, client, router]);
  const retry = useMutation({
    mutationFn: () =>
      api<Job>("/jobs/" + jid + "/retry?mode=deterministic", {
        method: "POST",
      }),
    onSuccess: (j) => {
      client.setQueryData(["job", jid], j);
    },
  });
  const fields = [
    ["name", t("Наименование", "Атауы")],
    ["quantity", t("Остаток", "Қалдық")],
    ["acquisition_cost", t("Закупочная цена", "Сатып алу бағасы")],
    ["supplier_cost", t("Цена дозакупки", "Қосымша сатып алу бағасы")],
    ["volume", t("Объём", "Көлемі")],
    ["dimensions", t("Размер", "Өлшемі")],
    ["certificate", t("Документы", "Құжаттар")],
  ];
  return (
    <>
      <PageHeading
        eyebrow={t(
          "ДОКУМЕНТЫ → ДОКАЗАТЕЛЬСТВА → РЕШЕНИЕ",
          "ҚҰЖАТТАР → ДӘЛЕЛДЕР → ШЕШІМ",
        )}
        title={t("Новый анализ", "Жаңа талдау")}
        subtitle={t(
          "Загрузите спецификацию закупки и ваши реальные остатки.",
          "Сатып алу спецификациясын және нақты қалдықтарыңызды жүктеңіз.",
        )}
      />
      <div className="wizard-steps">
        {[
          t("Документы", "Құжаттар"),
          t("Проверка данных", "Деректерді тексеру"),
          t("Анализ и решение", "Талдау және шешім"),
        ].map((v, i) => (
          <div key={i} className={i === 0 ? "active" : ""}>
            <span>{i + 1}</span>
            {v}
          </div>
        ))}
      </div>
      {jid && job.data && job.data.status !== "failed" ? (
        <Processing job={job.data} />
      ) : (
        <>
          <div className="upload-grid">
            <section className="panel upload-panel">
              <div className="panel-heading">
                <h2>
                  <span className="step-number">01</span>
                  {t("Техническая спецификация", "Техникалық спецификация")}
                </h2>
              </div>
              <p>
                {t(
                  "Текстовый PDF. Для сканов нужен установленный OCR.",
                  "Мәтіндік PDF. Сканерленген файлдарға орнатылған OCR қажет.",
                )}
              </p>
              <FileDrop kind="tender" file={pdf} onFile={setPdf} />
              <div className="upload-hint">
                <ShieldCheck size={15} />
                {t(
                  "Оригинал и номера страниц сохраняются.",
                  "Түпнұсқа мен бет нөмірлері сақталады.",
                )}
              </div>
            </section>
            <section className="panel upload-panel">
              <div className="panel-heading">
                <h2>
                  <span className="step-number">02</span>
                  {t("Инвентарь и цены", "Қорлар мен бағалар")}
                </h2>
              </div>
              <p>
                {t(
                  "Используйте сохранённый каталог или импортируйте новый.",
                  "Сақталған каталогты пайдаланыңыз немесе жаңасын импорттаңыз.",
                )}
              </p>
              <label className="field">
                {t("Сохранённый каталог", "Сақталған каталог")}
                <select value={cid} onChange={(e) => setCid(e.target.value)}>
                  <option value="">
                    {t("Загрузить новый каталог", "Жаңа каталог жүктеу")}
                  </option>
                  {catalogs.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.count} {t("товаров", "тауар")}
                    </option>
                  ))}
                </select>
              </label>
              {!cid && (
                <FileDrop
                  kind="inventory"
                  file={xlsx}
                  onFile={(f) => {
                    setXlsx(f);
                    setPreview(null);
                    setMapping({});
                  }}
                />
              )}
              {!cid && xlsx && (
                <Button
                  variant="ghost"
                  onClick={() => inspect.mutate(xlsx)}
                  disabled={inspect.isPending}
                >
                  {inspect.isPending ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <FileSpreadsheet size={15} />
                  )}{" "}
                  {t(
                    "Проверить соответствие столбцов",
                    "Баған сәйкестігін тексеру",
                  )}
                </Button>
              )}
            </section>
          </div>
          {preview && !cid && (
            <section className="panel mapping-panel">
              <h2>
                {t(
                  "Соответствие столбцов Excel",
                  "Excel бағандарының сәйкестігі",
                )}
              </h2>
              <p className="muted">
                {t(
                  "Укажите, какие столбцы содержат данные. Наименование и остаток обязательны.",
                  "Деректер қай бағанда екенін көрсетіңіз. Атауы мен қалдық міндетті.",
                )}
              </p>
              <div className="form-grid">
                {fields.map(([key, label]) => (
                  <label key={key} className="field">
                    {label}
                    <select
                      value={mapping[key] || ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [key]: e.target.value })
                      }
                    >
                      <option value="">
                        {t("Не сопоставлено", "Сәйкестендірілмеген")}
                      </option>
                      {preview.headers.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          )}
          <section className="panel processing-mode">
            <div>
              <h2>{t("Режим обработки", "Өңдеу режимі")}</h2>
              <p>
                {t(
                  "Арифметика и проверки соответствия всегда выполняются программно.",
                  "Арифметика және сәйкестік тексеруі әрқашан бағдарламалық орындалады.",
                )}
              </p>
            </div>
            <label className="field">
              {t("Извлечение требований", "Талаптарды шығару")}
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="deterministic">
                  {t(
                    "Локально · правила извлечения",
                    "Жергілікті · шығару ережелері",
                  )}
                </option>
                <option
                  value="gemini"
                  disabled={!health.data?.gemini_available}
                >
                  {health.data?.gemini_available
                    ? t("Gemini · AI-интерпретация", "Gemini · AI түсіндіру")
                    : t(
                        "Gemini · ключ не настроен",
                        "Gemini · кілт бапталмаған",
                      )}
                </option>
              </select>
            </label>
          </section>
          <div className="upload-submit">
            <p>
              {t(
                "После извлечения вы сможете исправить товары, количества и характеристики.",
                "Шығарғаннан кейін тауарларды, санын және сипаттамаларын түзете аласыз.",
              )}
              {mode === "gemini" && (
                <strong>
                  {t(
                    "Текст документа будет отправлен в Google Gemini.",
                    "Құжат мәтіні Google Gemini-ге жіберіледі.",
                  )}
                </strong>
              )}
            </p>
            <Button
              onClick={() => upload.mutate()}
              disabled={!pdf || (!cid && !xlsx) || upload.isPending}
            >
              {upload.isPending ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <ArrowRight size={17} />
              )}{" "}
              {t("Извлечь требования", "Талаптарды шығару")}
            </Button>
          </div>
          {upload.isError && <ErrorState error={upload.error} />}{" "}
          {inspect.isError && <ErrorState error={inspect.error} />}{" "}
          {job.data?.status === "failed" && (
            <ErrorState
              error={new Error(job.data.error || "Ошибка")}
              retry={() => retry.mutate()}
            />
          )}
          <p className="upload-demo-link">
            {t("Нет документов под рукой?", "Қолыңызда құжат жоқ па?")}{" "}
            <Link href="/demo">
              {t("Используйте учебный пример", "Оқу мысалын пайдаланыңыз")}
              <ArrowUpRightIcon />
            </Link>
          </p>
        </>
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={14} />;
}
