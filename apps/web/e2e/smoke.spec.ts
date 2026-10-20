import { expect, test } from "@playwright/test";

test("picks a resort, ranks runs, scrubs time, opens a run, and works offline", async ({ page, context }) => {
  // First visit: choose a resort.
  await page.goto("/");
  const cards = page.getByTestId("resort-card");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  await cards.filter({ hasText: "Steamboat" }).click();
  await page.getByRole("button", { name: "Continue to Steamboat" }).click();
  await expect(page).toHaveURL(/resort=steamboat/);
  await expect(page.getByText("Best right now")).toBeVisible({ timeout: 30_000 });

  // Switch resorts from the header.
  await page.getByTestId("resort-button").click();
  await cards.filter({ hasText: "Breckenridge" }).click();
  await page.getByRole("button", { name: "Continue to Breckenridge" }).click();
  await expect(page.getByTestId("resort-button")).toContainText("Breckenridge");

  // Runs tab on a demo spring day: what's best at 9am isn't what's best at 3pm.
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("tab", { name: "Runs" }).click();
  const rows = page.getByTestId("run-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const slider = page.getByRole("slider", { name: "Time of day" });
  const firstName = () => rows.first().getByTestId("run-name").innerText();
  await slider.fill("9");
  const morning = await firstName();
  await slider.fill("15");
  await expect.poll(firstName).not.toBe(morning);

  // Run details.
  await rows.first().getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How did it ski?" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Unmarked tree areas: off until the cautions are accepted, then listed with their own warnings.
  await expect(page.getByTestId("unmarked-section")).toHaveCount(0);
  await page.getByRole("button", { name: "Read the cautions" }).click();
  const sheet = page.getByTestId("unmarked-sheet");
  await expect(sheet.getByText("Tree wells and deep snow can kill")).toBeVisible();
  const showAreas = sheet.getByRole("button", { name: "Show unmarked areas" });
  await expect(showAreas).toBeDisabled();
  await sheet.getByRole("checkbox").check();
  await showAreas.click();
  const section = page.getByTestId("unmarked-section");
  await expect(section).toBeVisible();
  await expect(section.getByText("Off-piste: not marked, not patrolled like runs")).toBeVisible();
  await section.getByTestId("run-row").first().getByRole("button").click();
  await expect(page.getByTestId("unmarked-caution")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hazards found for this area" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Offline: once the service worker has cached the app and data, a reload with no network still works.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText("Best right now")).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  // Scores need the forecast, so this proves the weather came from a cache too. (Within the 15-minute HTTP cache
  // window the browser answers directly; after it the service worker serves its copy and the app shows an offline banner.)
  await expect(page.getByText("Best right now")).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});
