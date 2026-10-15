import { test, expect } from "@playwright/test";

test("discovery filters can be cleared and announce restored results", async ({
  page,
}) => {
  await page.goto("/discovery");
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Поиск", exact: true })
    .fill("no-such-tender-unique");
  await expect(
    page.getByText("Нет результатов. Измените фильтры."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Поиск", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByText("Нет результатов. Измените фильтры."),
  ).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Найдено:");
  await expect(
    page.getByRole("link", { name: "Возможности", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
