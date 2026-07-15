export const toolDefinitions = [
  { name: "login", description: "登录本地卖家平台", parameters: { type: "object", properties: {} } },
  { name: "openRefundOrders", description: "查询退款订单并返回订单信息", parameters: { type: "object", properties: { query: { type: "string" } } } },
  { name: "queryProduct", description: "查询商品并返回价格、库存和上下架状态", parameters: { type: "object", required: ["query"], properties: { query: { type: "string" } } } },
  { name: "updateProductPrice", description: "修改商品价格并保存", parameters: { type: "object", required: ["sku", "price"], properties: { sku: { type: "string" }, price: { type: "number" } } } },
  { name: "updateProductStock", description: "修改商品库存并保存", parameters: { type: "object", required: ["sku", "stock"], properties: { sku: { type: "string" }, stock: { type: "integer" } } } },
  { name: "activateProduct", description: "上架或下架商品", parameters: { type: "object", required: ["sku", "active"], properties: { sku: { type: "string" }, active: { type: "boolean" } } } },
  { name: "downloadReport", description: "下载指定类型和周期的 CSV 报表；用户说退货报表时使用退款报表", parameters: { type: "object", properties: { type: { type: "string", enum: ["销售报表", "商品报表", "退款报表"] }, range: { type: "string", enum: ["今天", "过去 7 天", "本月", "上月"] } } } },
];
