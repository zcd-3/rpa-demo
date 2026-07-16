import { openProducts } from "./helpers.js";

const statuses = ["全部", "已上架", "已下架"];

export async function queryProduct({ page, query = "", status = "全部" }) {
  if (typeof query !== "string") throw new Error("queryProduct 的 query 必须是字符串");
  if (!statuses.includes(status)) throw new Error(`queryProduct 的 status 可选值：${statuses.join("、")}`);
  await openProducts(page);
  await page.getByTestId("product-search").fill(query);
  await page.getByTestId("product-status").selectOption({ label: status });
  const rows = page.locator(".product-table tbody tr");
  const count = await rows.count();
  const products = [];
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const cells = row.locator("td");
    products.push({
      name: (await cells.nth(0).locator("strong").textContent())?.trim(),
      sku: (await cells.nth(1).locator("code").textContent())?.trim(),
      asin: (await cells.nth(1).locator("small").textContent())?.trim(),
      price: Number(await cells.nth(2).locator("input").inputValue()),
      stock: Number(await cells.nth(3).locator("input").inputValue()),
      status: (await cells.nth(4).textContent())?.trim(),
    });
  }
  return { success: true, query, statusFilter: status, count, products };
}
