import { config } from "../config.js";
import { ensureLoggedIn, gotoWithRetry } from "./helpers.js";

export async function openRefundOrders({ page, query = "" }) {
  await ensureLoggedIn(page);
  await gotoWithRetry(page, `${config.baseUrl}/refunds`, { waitUntil: "domcontentloaded" });
  const search = page.getByTestId("refund-search");
  await search.waitFor({ state: "visible" });
  if (query) await search.fill(query);
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  const refunds = [];
  for (let index = 0; index < count; index += 1) {
    const cells = rows.nth(index).locator("td");
    refunds.push({
      id: (await cells.nth(0).locator("strong").textContent())?.trim(),
      created: (await cells.nth(0).locator("small").textContent())?.trim(),
      order: (await cells.nth(1).locator("code").textContent())?.trim(),
      product: (await cells.nth(2).locator("strong").textContent())?.trim(),
      buyer: (await cells.nth(2).locator("small").textContent())?.trim(),
      amount: (await cells.nth(3).textContent())?.trim(),
      reason: (await cells.nth(4).textContent())?.trim(),
      status: (await cells.nth(5).textContent())?.trim(),
    });
  }
  return {
    success: true,
    query,
    count,
    refunds,
  };
}
