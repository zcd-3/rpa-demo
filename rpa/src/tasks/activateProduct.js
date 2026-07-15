import { openProducts } from "./helpers.js";
import { queryProduct } from "./queryProduct.js";

export async function activateProduct({ page, sku, active = true }) {
  if (!sku) throw new Error("activateProduct 需要 sku");
  await openProducts(page);
  const toggle = page.getByTestId(`toggle-${sku}`);
  if ((await toggle.count()) !== 1) throw new Error(`未找到 SKU：${sku}`);
  const currentlyActive = (await toggle.textContent())?.trim() === "下架";
  if (currentlyActive !== Boolean(active)) await toggle.click();
  return queryProduct({ page, query: sku });
}

export async function deactivateProduct(args) {
  return activateProduct({ ...args, active: false });
}
