import { test, expect } from "@playwright/test";
import path from "node:path";
test("real uploaded documents, evidence, finance, export and persistence", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Анализировать тендер", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Новый анализ" }),
  ).toBeVisible();
  await page
    .getByTestId("tender-file")
    .setInputFiles(path.resolve("../../demo/tender-enamel.pdf"));
  await page
    .getByTestId("inventory-file")
    .setInputFiles(path.resolve("../../demo/inventory.xlsx"));
  await page.getByRole("button", { name: "Извлечь требования" }).click();
  await expect(
    page.getByRole("heading", { name: "Проверьте извлечённые данные" }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Запустить анализ" }).click();
  await expect(page.getByTestId("decision")).toContainText("Требует внимания", {
    timeout: 60000,
  });
  await page
    .getByRole("tab", { name: "Матрица требований", exact: true })
    .click();
  await page.getByRole("button", { name: "Конфликты", exact: true }).click();
  await expect(page.getByText("2.5 л", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Источник", exact: true })
    .first()
    .click();
  await expect(page.getByText("Страница 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page
    .getByRole("tab", { name: "Симулятор прибыли", exact: true })
    .click();
  const initial = await page.getByTestId("profit-value").textContent();
  await page.getByLabel("Доставка, ₸", { exact: true }).fill("25000");
  await page.getByRole("button", { name: "Пересчитать" }).click();
  await expect(page.getByTestId("profit-value")).not.toHaveText(initial!);
  await page.reload();
  await page
    .getByRole("tab", { name: "Симулятор прибыли", exact: true })
    .click();
  await expect(page.getByLabel("Доставка, ₸", { exact: true })).toHaveValue(
    "25000",
  );
  const dl = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "PDF-отчёт", exact: true })
    .first()
    .click();
  const download = await dl;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole("button", { name: "Қазақша" }).click();
  await expect(
    page.getByRole("tab", { name: "Пайда симуляторы", exact: true }),
  ).toBeVisible();
});
test("validation, mobile menu and empty dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/new");
  await expect(
    page.getByRole("button", { name: "Извлечь требования" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("link", { name: "Обзор", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Обзор возможностей" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("real demo execution, navigation and negative-profit decision", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Запустить демо", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("decision")).toContainText("Требует внимания", {
    timeout: 60000,
  });
  await page
    .getByRole("tab", { name: "Симулятор прибыли", exact: true })
    .click();
  await expect(page.getByLabel("Доставка, ₸", { exact: true })).toHaveValue(
    "5000",
  );
  await page.getByLabel("Цена предложения, ₸", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Пересчитать", exact: true }).click();
  await expect(page.getByTestId("profit-value")).toContainText("-");
  await page.getByRole("tab", { name: "Обзор и решение", exact: true }).click();
  await expect(page.getByTestId("decision")).toContainText("Невыполним");
  await page.getByRole("link", { name: "Мой каталог", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Мой каталог", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Поиск товаров", { exact: true }).fill("EN-35-Y");
  await expect(
    page.getByText("Эмаль жёлтая ПФ-115", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Редактировать товар", exact: true })
    .click();
  await expect(page.getByLabel("Остаток, ед.", { exact: true })).toHaveValue(
    "8",
  );
  await page.getByLabel("Остаток, ед.", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.getByLabel("Поиск товаров", { exact: true }).fill("EN-35-Y");
  await expect(page.getByText("9 шт", { exact: true })).toBeVisible();
  // Restore reusable demo catalog to its source quantity.
  await page
    .getByRole("button", { name: "Редактировать товар", exact: true })
    .click();
  await page.getByLabel("Остаток, ед.", { exact: true }).fill("8");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await page.getByRole("link", { name: "Отчёты", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Отчёты и результаты", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Возможности", exact: true }).click();
  await expect(
    page.getByText("Подключение к порталам не настроено", { exact: true }),
  ).toBeVisible();
});
test("invalid file and honest backend error UI", async ({ page }) => {
  await page.goto("/new");
  await page
    .getByTestId("tender-file")
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not pdf"),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "Неподдерживаемый формат" }),
  ).toBeVisible();
  await page
    .getByTestId("tender-file")
    .setInputFiles(path.resolve("../../demo/tender-enamel.pdf"));
  await page
    .getByTestId("inventory-file")
    .setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Наименование,Количество\nЭмаль,неизвестно"),
    });
  await page
    .getByRole("button", { name: "Извлечь требования", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "неотрицательное число" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
});
