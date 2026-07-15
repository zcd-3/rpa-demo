import { openProducts } from "./helpers.js";
import { queryProduct } from "./queryProduct.js";

export async function updateProductPrice({ page, sku, price }) {
  if (!sku || !Number.isFinite(Number(price)) || Number(price) < 0) {
    throw new Error("updateProductPrice 需要有效的 sku 和非负 price");
  }
  const nextPrice = Number(price);
  await openProducts(page);
  const input = page.getByTestId(`price-${sku}`);
  if ((await input.count()) !== 1) throw new Error(`未找到 SKU：${sku}`);
  const currentPrice = Number(await input.inputValue());
  if (currentPrice === nextPrice) {
    return queryProduct({ page, query: sku });
  }
  await input.fill(String(nextPrice));
  await page.getByTestId(`save-${sku}`).click();
  await page.getByText(`${sku} 的修改已保存，刷新页面后仍会保留`).waitFor();
  return queryProduct({ page, query: sku });
}
