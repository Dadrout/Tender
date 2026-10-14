export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ detail: "Сервис недоступен" }));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : body.detail?.map((v: { msg: string }) => v.msg).join("; ") ||
          "Ошибка запроса",
    );
  }
  return res.json();
}
export const kzt = (v: string | number | null | undefined, locale = "ru") =>
  v == null
    ? "—"
    : new Intl.NumberFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
        maximumFractionDigits: 0,
      }).format(Number(v)) + " ₸";
export const date = (v: string) =>
  new Intl.DateTimeFormat("ru-KZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Almaty",
  }).format(new Date(v));
