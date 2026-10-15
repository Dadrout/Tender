import { test, expect } from "@playwright/test";

test("chosen language and theme survive a page reload", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "Қазақша", exact: true }).click();
  await page
    .getByRole("button", { name: "Тақырыпты өзгерту", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const theme of ["light", "dark"] as const) {
  test(`workspace remains readable and contained across screen sizes: ${theme}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((value) => {
      localStorage.setItem("qazbid-theme", value);
      localStorage.setItem("qazbid-locale", "ru");
    }, theme);
    const analyses = await (await request.get("/api/analyses")).json();
    const analysis = analyses.find(
      (a: {
        state: string;
        synthetic: boolean;
        financial?: { profit: string };
      }) =>
        a.state === "completed" &&
        a.synthetic &&
        Number(a.financial?.profit) > 0,
    );
    expect(analysis).toBeTruthy();
    for (const [width, height] of [
      [375, 812],
      [768, 1024],
      [1440, 900],
      [812, 375],
    ]) {
      await page.setViewportSize({ width, height });
      for (const route of [
        "/",
        "/dashboard",
        "/new",
        "/discovery",
        "/inventory",
        "/reports",
        "/demo",
        `/analyses/${analysis.id}`,
      ]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator(".loading")).toHaveCount(0);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const sizes = await page.evaluate(() => ({
          actual: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
        expect(
          sizes.actual,
          `${route} at ${width}px in ${theme}`,
        ).toBeLessThanOrEqual(sizes.viewport);
      }
      for (const tab of [
        "Матрица требований",
        "Симулятор прибыли",
        "Риски",
        "Данные тендера",
      ]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${tab} at ${width}px`,
        ).toBe(true);
      }
      await page
        .getByRole("tab", { name: "Обзор и решение", exact: true })
        .click();
      if (width === 1440) {
        const pairs = await page.evaluate(() => {
          const text = getComputedStyle(
            document.querySelector(".page-heading p")!,
          );
          const action = getComputedStyle(
            document.querySelector(".nav-create")!,
          );
          const metric = getComputedStyle(document.querySelector(".metric")!);
          const foot = getComputedStyle(
            document.querySelector(".metric small")!,
          );
          return [
            [text.color, getComputedStyle(document.body).backgroundColor],
            [action.color, action.backgroundColor],
            [foot.color, metric.backgroundColor],
          ];
        });
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((n) => {
              const c = n / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        for (const [foreground, background] of pairs) {
          const values = [luminance(foreground), luminance(background)].sort(
            (a, b) => b - a,
          );
          expect(
            (values[0] + 0.05) / (values[1] + 0.05),
            `${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      await page.screenshot({
        path: `/tmp/qazbid-redesign/analysis-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Қазақша", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Шолу және шешім", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/qazbid-redesign/analysis-${theme}-kk-375.png`,
      fullPage: true,
    });
  });
}
