import { openProducts } from "./helpers.js";

export async function queryProduct({ page, query }) {
  if (!query) throw new Error("queryProduct 需要 query（商品名、SKU 或 ASIN）");
  await openProducts(page);
  await page.getByTestId("product-search").fill(query);
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
  return { success: true, query, count, products };
}
