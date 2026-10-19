import { expect, test } from "@playwright/test";

test("ranks runs, scrubs time, opens a run, and works offline", async ({ page, context }) => {
  await page.goto("/");
  const rows = page.getByTestId("run-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });

  // A demo spring day: what's best at 9am isn't what's best at 3pm.
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Time of day" });
  await slider.fill("9");
  const morning = await rows.first().locator(".font-extrabold").innerText();
  await slider.fill("15");
  await expect.poll(async () => rows.first().locator(".font-extrabold").innerText()).not.toBe(morning);

  // Run detail sheet.
  await rows.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("How did it ski?")).toBeVisible();
  await page.keyboard.press("Escape");

  // Offline: once the service worker has cached the app and data, a reload with no network still works.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  // Scores need the forecast, so this proves the weather came from a cache too. (Within the 15-minute HTTP cache
  // window the browser answers directly; after it the service worker serves its copy and the app shows an offline banner.)
  await expect(page.getByText("Best right now")).toBeVisible();
  await context.setOffline(false);
});
