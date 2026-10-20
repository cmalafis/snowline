import { expect, test, type Browser, type Page } from "@playwright/test";

async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.goto("/?resort=steamboat");
  await page.getByRole("tab", { name: "Runs" }).click();
  return page;
}

async function findRun(page: Page, name: string) {
  await page.getByRole("searchbox", { name: "Find a run" }).fill(name);
  const row = page.getByTestId("run-row").filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  return row;
}

async function report(page: Page, name: string, groomed: boolean | null) {
  await (await findRun(page, name)).getByRole("button").click();
  if (groomed === null) await page.getByRole("button", { name: "Withdraw my report" }).click();
  else await page.getByRole("switch").setChecked(groomed);
  await page.keyboard.press("Escape");
}

test("grooming reports change a run for everyone once two skiers agree", async ({ browser }) => {
  const a = await phone(browser);
  const firstGroomed = a.getByTestId("run-row").filter({ hasText: "usually groomed" }).first();
  await expect(firstGroomed).toBeVisible({ timeout: 30_000 });
  const name = (await firstGroomed.getByTestId("run-name").innerText()).trim();

  // One report: a hint for others, not an override.
  await report(a, name, false);
  await expect(await findRun(a, name)).toContainText("not groomed (your report)");
  const b = await phone(browser);
  await expect(await findRun(b, name)).toContainText("usually groomed · 1 skier says not groomed today");

  // A second phone agrees: now it's not groomed for everyone.
  await report(b, name, false);
  const c = await phone(browser);
  await expect(await findRun(c, name)).toContainText("not groomed (2 skiers reported)");

  // Clean up.
  await report(a, name, null);
  await report(b, name, null);
  for (const p of [a, b, c]) await p.context().close();
});
