export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /password|token|secret|api.?key|authorization/i.test(key) ? "[已隐藏]" : redactSensitive(item),
  ]));
}

export function verboseLog(enabled, label, value) {
  if (!enabled) return;
  const detail = value === undefined ? "" : `: ${JSON.stringify(redactSensitive(value))}`;
  console.error(`[verbose] ${label}${detail}`);
}

export function describeWriteOperation(name, args = {}) {
  if (name === "updateProductPrice") return `将商品 ${args.sku} 的价格修改为 ${args.price} 美元`;
  if (name === "updateProductStock") return `将商品 ${args.sku} 的库存修改为 ${args.stock}`;
  if (name === "activateProduct") return `${args.active ? "上架" : "下架"}商品 ${args.sku}`;
  if (name === "deactivateProduct") return `下架商品 ${args.sku}`;
  return "执行这项卖家平台写操作";
}
