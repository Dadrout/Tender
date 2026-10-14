"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UploadCloud,
  SlidersHorizontal,
  Save,
  Plus,
  AlertTriangle,
  LoaderCircle,
} from "lucide-react";
import { api, kzt } from "@/lib/api";
import { useLocale } from "@/lib/context";
import { Product, Catalog } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { FileDrop } from "./upload";
import { PageHeading, Empty, Loading, ErrorState } from "./shared";
export function Inventory() {
  const { t } = useLocale();
  const client = useQueryClient();
  const [cid, setCid] = useState("");
  const [search, setSearch] = useState("");
  const [missing, setMissing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const cq = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => api<Catalog[]>("/catalogs"),
  });
  useEffect(() => {
    if (!cid && cq.data?.length) setCid(cq.data[0].id);
  }, [cq.data, cid]);
  const pq = useQuery({
    queryKey: ["catalog", cid],
    queryFn: () =>
      api<{ id: string; name: string; products: Product[] }>(
        "/catalogs/" + cid,
      ),
    enabled: !!cid,
  });
  const inspect = useMutation({
    mutationFn: () => {
      const d = new FormData();
      d.set("file", file!);
      return api<{ headers: string[]; mapping: Record<string, string> }>(
        "/catalogs/preview",
        { method: "POST", body: d },
      );
    },
    onSuccess: (p) => {
      setHeaders(p.headers);
      setMapping(p.mapping);
    },
  });
  const importFile = useMutation({
    mutationFn: () => {
      const d = new FormData();
      d.set("file", file!);
      if (headers.length)
        d.set(
          "mapping",
          JSON.stringify(
            Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)),
          ),
        );
      return api<Catalog>("/catalogs", { method: "POST", body: d });
    },
    onSuccess: (c) => {
      client.invalidateQueries({ queryKey: ["catalogs"] });
      setCid(c.id);
      setImportOpen(false);
      setFile(null);
      setHeaders([]);
    },
  });
  const save = useMutation({
    mutationFn: (p: Product) =>
      api("/catalogs/" + cid + "/products/" + p.id, {
        method: "PUT",
        body: JSON.stringify(p),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["catalog", cid] });
      client.invalidateQueries({ queryKey: ["analyses"] });
      client.invalidateQueries({ queryKey: ["analysis"] });
      setEditing(null);
    },
  });
  const list =
    pq.data?.products.filter(
      (p) =>
        JSON.stringify(p).toLowerCase().includes(search.toLowerCase()) &&
        (!missing ||
          p.acquisition_cost == null ||
          !p.attributes.volume ||
          !p.attributes.certificate),
    ) || [];
  const attrs = [
    ["volume", t("Объём / фасовка", "Көлемі / қаптама")],
    ["dimensions", t("Размеры", "Өлшемдері")],
    ["color", t("Цвет", "Түсі")],
    ["material", t("Материал", "Материал")],
    ["brand", t("Бренд / марка", "Бренд / марка")],
    ["standard", t("Стандарт", "Стандарт")],
    ["certificate", t("Сертификат / документ", "Сертификат / құжат")],
  ];
  const base = [
    ["name", t("Название", "Атауы")],
    ["sku", t("Артикул", "Артикул")],
    ["quantity", t("Остаток, ед.", "Қалдық, бірл.")],
    ["unit", t("Единица измерения", "Өлшем бірлігі")],
    ["acquisition_cost", t("Цена приобретения, ₸", "Сатып алу бағасы, ₸")],
    ["supplier_cost", t("Цена дозакупки, ₸", "Қосымша сатып алу бағасы, ₸")],
    ["supplier", t("Поставщик", "Жеткізуші")],
    ["lead_days", t("Срок поставки, дней", "Жеткізу мерзімі, күн")],
  ] as const;
  return (
    <>
      <PageHeading
        title={t("Мой каталог", "Менің каталогым")}
        subtitle={t(
          "Актуальные остатки и характеристики — основа достоверного анализа.",
          "Өзекті қалдықтар мен сипаттамалар — сенімді талдаудың негізі.",
        )}
        action={
          <Button onClick={() => setImportOpen(true)}>
            <UploadCloud size={17} />
            {t("Импортировать Excel", "Excel импорттау")}
          </Button>
        }
      />
      {cq.isLoading ? (
        <Loading />
      ) : cq.isError ? (
        <ErrorState error={cq.error} />
      ) : !cq.data?.length ? (
        <Empty
          title={t("Добавьте каталог товаров", "Тауарлар каталогын қосыңыз")}
          description={t(
            "Импортируйте Excel или CSV. Каталог можно использовать в нескольких закупках.",
            "Excel немесе CSV импорттаңыз. Каталогты бірнеше сатып алуда пайдалануға болады.",
          )}
          action={
            <Button onClick={() => setImportOpen(true)}>
              <Plus size={16} />
              {t("Загрузить каталог", "Каталог жүктеу")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="catalog-toolbar">
            <label className="field">
              {t("Каталог", "Каталог")}
              <select value={cid} onChange={(e) => setCid(e.target.value)}>
                {cq.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.count}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-input">
              <Search size={17} />
              <input
                aria-label={t("Поиск товаров", "Тауарларды іздеу")}
                placeholder={t(
                  "Название, артикул, поставщик",
                  "Атауы, артикул, жеткізуші",
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={missing}
                onChange={(e) => setMissing(e.target.checked)}
              />
              {t("Неполные сведения", "Толық емес деректер")}
            </label>
          </div>
          <div className="catalog-summary">
            <span>
              {pq.data?.products.length || 0}{" "}
              {t("товаров в каталоге", "каталог тауары")}
            </span>
            <span>
              {t(
                "Изменения обновляют связанные анализы.",
                "Өзгерістер байланысты талдауларды жаңартады.",
              )}
            </span>
          </div>
          {pq.isLoading ? (
            <Loading />
          ) : pq.isError ? (
            <ErrorState error={pq.error} />
          ) : (
            <section className="panel">
              <div className="table-scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>{t("Товар", "Тауар")}</th>
                      <th>{t("Характеристики", "Сипаттамалар")}</th>
                      <th>{t("Остаток", "Қалдық")}</th>
                      <th>
                        {t("Стоимость запаса / ед.", "Қор бірлігінің құны")}
                      </th>
                      <th>{t("Дозакупка / ед.", "Қосымша бірлік құны")}</th>
                      <th>{t("Поставщик", "Жеткізуші")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <small>
                            {p.sku} · {t("строка", "жол")} {p.row}
                          </small>
                        </td>
                        <td>
                          <span>
                            {[
                              p.attributes.volume,
                              p.attributes.dimensions,
                              p.attributes.color,
                              p.attributes.material,
                            ]
                              .filter(Boolean)
                              .join(" · ") ||
                              t("Нет характеристик", "Сипаттамалар жоқ")}
                          </span>
                          {!p.attributes.certificate && (
                            <small className="missing-note">
                              <AlertTriangle size={12} />
                              {t("Документ не указан", "Құжат көрсетілмеген")}
                            </small>
                          )}
                        </td>
                        <td className="number-cell">
                          {p.quantity} {p.unit}
                        </td>
                        <td className="number-cell">
                          {kzt(p.acquisition_cost)}
                        </td>
                        <td className="number-cell">{kzt(p.supplier_cost)}</td>
                        <td>
                          <span>{p.supplier || "—"}</span>
                          <small>
                            {p.lead_days != null
                              ? p.lead_days + " " + t("дн.", "күн")
                              : "—"}{" "}
                            ·{" "}
                            {p.supplier_confirmed
                              ? t("Наличие указано", "Бар деп көрсетілген")
                              : t("Не подтверждено", "Расталмаған")}
                          </small>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            onClick={() => {
                              save.reset();
                              setEditing(structuredClone(p));
                            }}
                            aria-label={t(
                              "Редактировать товар",
                              "Тауарды өзгерту",
                            )}
                          >
                            <SlidersHorizontal size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!list.length && (
                  <p className="panel-empty">
                    {t("Товары не найдены.", "Тауарлар табылмады.")}
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
      <Dialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t("Импорт каталога", "Каталогты импорттау")}
        wide
      >
        <FileDrop
          kind="inventory"
          file={file}
          onFile={(f) => {
            setFile(f);
            setHeaders([]);
          }}
        />
        <div className="dialog-actions">
          <Button
            variant="secondary"
            onClick={() => inspect.mutate()}
            disabled={!file || inspect.isPending}
          >
            {t("Проверить столбцы", "Бағандарды тексеру")}
          </Button>
          <Button
            onClick={() => importFile.mutate()}
            disabled={!file || importFile.isPending}
          >
            {importFile.isPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <UploadCloud size={16} />
            )}{" "}
            {t("Импортировать", "Импорттау")}
          </Button>
        </div>
        {headers.length > 0 && (
          <div className="form-grid mapping-dialog">
            {[
              ...base,
              ...attrs,
              [
                "supplier_confirmed",
                t("Наличие поставщика", "Жеткізушіде болуы"),
              ],
            ].map(([key, label]) => (
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
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {inspect.isError && <ErrorState error={inspect.error} />}{" "}
        {importFile.isError && <ErrorState error={importFile.error} />}
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={t("Редактировать товар", "Тауарды өзгерту")}
        wide
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <div className="form-grid">
              {base.map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    required={key === "name" || key === "quantity"}
                    type={
                      [
                        "quantity",
                        "acquisition_cost",
                        "supplier_cost",
                        "lead_days",
                      ].includes(key)
                        ? "number"
                        : "text"
                    }
                    min="0"
                    step={key === "lead_days" ? "1" : "0.01"}
                    value={String(editing[key] ?? "")}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        [key]:
                          key === "lead_days"
                            ? e.target.value === ""
                              ? null
                              : Number(e.target.value)
                            : e.target.value ||
                              ([
                                "acquisition_cost",
                                "supplier_cost",
                                "supplier",
                              ].includes(key)
                                ? null
                                : ""),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <h3 className="form-section-title">
              {t("Подтверждённые характеристики", "Расталған сипаттамалар")}
            </h3>
            <div className="form-grid">
              {attrs.map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    value={editing.attributes[key] || ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        attributes: {
                          ...editing.attributes,
                          [key]: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editing.supplier_confirmed}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    supplier_confirmed: e.target.checked,
                  })
                }
              />
              {t(
                "Поставщик подтвердил наличие",
                "Жеткізуші тауардың бар екенін растады",
              )}
            </label>
            <p className="form-note">
              {t(
                "Указывайте документы только при наличии подтверждения. Исходная строка импорта сохраняется.",
                "Құжаттарды тек растау болғанда көрсетіңіз. Импорттың бастапқы жолы сақталады.",
              )}
            </p>
            <div className="dialog-actions">
              <Button type="submit" disabled={save.isPending}>
                <Save size={16} />
                {t("Сохранить изменения", "Өзгерістерді сақтау")}
              </Button>
            </div>
            {save.isError && <ErrorState error={save.error} />}
          </form>
        )}
      </Dialog>
    </>
  );
}
