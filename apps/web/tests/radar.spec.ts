import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("catalog opportunity leads to evidence review and an actual decision", async ({
  page,
  request,
}) => {
  const r = await request.post("/api/catalogs", {
    multipart: {
      file: {
        name: "radar-inventory.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: fs.readFileSync(path.resolve("../../demo/inventory.xlsx")),
      },
    },
  });
  expect(r.ok()).toBeTruthy();
  const catalog = await r.json();
  await page.goto("/discovery");
  await expect(
    page.getByRole("heading", { name: "Подбор по каталогу", exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await page
    .getByRole("combobox", { name: "Каталог для подбора", exact: true })
    .selectOption(catalog.id);
  const card = page.getByTestId("radar-demo-enamel");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Учебный пример");
  await expect(card.getByTestId("radar-profit")).toContainText("40");
  await expect(card).toContainText("Требует внимания");
  await card
    .getByRole("button", { name: "Проверить требования", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверьте извлечённые данные" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Запустить анализ", exact: true })
    .click();
  await expect(page.getByTestId("decision")).toContainText("Требует внимания");
  await expect(
    page.getByRole("heading", { name: "Почему такое решение", exact: true }),
  ).toBeVisible();
});

test("unrelated stock gives an actionable empty radar and does not invent profit", async ({
  page,
  request,
}) => {
  const r = await request.post("/api/catalogs", {
    multipart: {
      file: {
        name: "monitors.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "Наименование,Количество,Единица,Закупочная цена\nМонитор,10,шт,1000\n",
        ),
      },
    },
  });
  expect(r.ok()).toBeTruthy();
  const catalog = await r.json();
  await page.goto("/discovery");
  await page
    .getByRole("combobox", { name: "Каталог для подбора", exact: true })
    .selectOption(catalog.id);
  await expect(
    page.getByRole("heading", {
      name: "Нет совпадений с каталогом",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Только с совпадениями", { exact: true }).uncheck();
  await expect(page.getByTestId("radar-demo-enamel")).toBeVisible();
  await expect(
    page.getByTestId("radar-demo-enamel").getByTestId("radar-profit"),
  ).toHaveText("—");
});

test("historical original has no invented budget and survives review with provenance", async ({
  page,
  request,
}) => {
  const r = await request.post("/api/catalogs", {
    multipart: {
      file: {
        name: "paper-example.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "Наименование,Количество,Единица,Закупочная цена\nБумага для офисного оборудования,100,Одна пачка,1000\n",
        ),
      },
    },
  });
  expect(r.ok()).toBeTruthy();
  const catalog = await r.json();
  await page.goto("/discovery");
  await page
    .getByRole("combobox", { name: "Каталог для подбора", exact: true })
    .selectOption(catalog.id);
  const card = page.getByTestId(
    "radar-public-sk-326759-1099036-taraz-paper-2019",
  );
  await expect(card).toContainText("2019");
  await expect(card).toContainText("Текущий статус не проверен");
  await expect(card.getByTestId("radar-profit")).toHaveText("—");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/qazbid-radar/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/qazbid-radar/mobile.png",
    fullPage: true,
  });
  await card
    .getByRole("button", { name: "Проверить требования", exact: true })
    .click();
  await expect(
    page.getByText("Исторический публичный документ", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Запустить анализ", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Почему такое решение", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Исторический публичный документ", { exact: true }),
  ).toBeVisible();
});
