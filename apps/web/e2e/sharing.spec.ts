import { expect, test } from "@playwright/test";

test("a grooming report from one phone shows up on another", async ({ browser }) => {
  const phoneA = await browser.newContext({ serviceWorkers: "block" });
  const phoneB = await browser.newContext({ serviceWorkers: "block" });
  const a = await phoneA.newPage();
  const b = await phoneB.newPage();

  // Phone A: find a usually-groomed run on today's live forecast and report it wasn't groomed.
  await a.goto("/?resort=steamboat");
  await a.getByRole("tab", { name: "Runs" }).click();
  const rowA = a.getByTestId("run-row").filter({ hasText: "usually groomed" }).first();
  await expect(rowA).toBeVisible({ timeout: 30_000 });
  const name = (await rowA.getByTestId("run-name").innerText()).trim();
  await rowA.getByRole("button").click();
  const toggle = a.getByRole("switch");
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(a.getByText("Your report is shared with everyone for today.")).toBeVisible();
  await a.keyboard.press("Escape");
  // Not groomed scores lower, so it may drop out of the top of the list: search for it.
  await a.getByRole("searchbox", { name: "Find a run" }).fill(name);
  await expect(a.getByTestId("run-row").filter({ hasText: name }).first()).toContainText("not groomed (your report)");

  // Phone B: a different device sees the shared report.
  await b.goto("/?resort=steamboat");
  await b.getByRole("tab", { name: "Runs" }).click();
  await b.getByRole("searchbox", { name: "Find a run" }).fill(name);
  const rowB = b.getByTestId("run-row").filter({ hasText: name }).first();
  await expect(rowB).toContainText("not groomed (1 skier reported)", { timeout: 30_000 });

  // Clean up: phone A withdraws its report.
  await a.getByTestId("run-row").filter({ hasText: name }).first().getByRole("button").click();
  await a.getByRole("button", { name: "Withdraw my report" }).click();
  await a.keyboard.press("Escape");
  await phoneA.close();
  await phoneB.close();
});
