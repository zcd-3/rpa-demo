import { openProducts } from "./helpers.js";
import { queryProduct } from "./queryProduct.js";
import { RpaError } from "../errors.js";

export async function updateProductStock({ page, sku, stock }) {
  if (!sku || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
    throw new Error("updateProductStock 需要有效的 sku 和非负整数 stock");
  }
  const nextStock = Number(stock);
  await openProducts(page);
  const input = page.getByTestId(`stock-${sku}`);
  if ((await input.count()) !== 1) throw new RpaError("PRODUCT_NOT_FOUND", `未找到 SKU：${sku}`);
  const currentStock = Number(await input.inputValue());
  if (currentStock === nextStock) {
    return queryProduct({ page, query: sku });
  }
  await input.fill(String(nextStock));
  await page.getByTestId(`save-${sku}`).click();
  await page.getByText(`${sku} 的修改已保存，刷新页面后仍会保留`).waitFor();
  return queryProduct({ page, query: sku });
}
