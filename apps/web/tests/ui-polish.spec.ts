import { test, expect } from "@playwright/test";

test("demo is easy to start and stays readable with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("qazbid-locale", "ru");
    localStorage.setItem("qazbid-theme", "light");
  });
  await page.goto("/demo");
  await expect(
    page.getByText("Начните с этого", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Запустить демо", exact: true }),
  ).toHaveCount(3);
  for (const [width, height] of [
    [1440, 1000],
    [375, 812],
    [812, 375],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Сменить тему", exact: true })
          .click();
      await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/tmp/qazbid-polish/demo-${theme}-${width}.png`,
        fullPage: true,
      });
      const motion = await page
        .getByRole("button", { name: "Запустить демо", exact: true })
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration);
      expect(motion).toBe("0s");
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Сменить тему", exact: true })
          .click();
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const start = page
    .getByRole("button", { name: "Запустить демо", exact: true })
    .first();
  await page.keyboard.press("Tab");
  await start.focus();
  expect(
    await start.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
});
