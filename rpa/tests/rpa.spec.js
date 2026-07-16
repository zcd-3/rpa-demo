// @ts-check
import fs from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { activateProduct } from "../src/tasks/activateProduct.js";
import { downloadReport } from "../src/tasks/downloadReport.js";
import { openRefundOrders } from "../src/tasks/openRefundOrders.js";
import { queryProduct } from "../src/tasks/queryProduct.js";
import { updateProductPrice } from "../src/tasks/updateProductPrice.js";
import { updateProductStock } from "../src/tasks/updateProductStock.js";

test.describe.configure({ mode: "serial" });

test("查询商品并返回结构化字段", async ({ page }) => {
  const result = await queryProduct({ page, query: "USB" });

  expect(result.success).toBe(true);
  expect(result.count).toBe(1);
  expect(result.products[0]).toMatchObject({
    sku: "HUB-7IN1-GRY",
    asin: "B0F1S8J4W6",
  });
  expect(result.products[0].price).toEqual(expect.any(Number));
  expect(result.products[0].stock).toEqual(expect.any(Number));
});

test("价格相同时不会点击禁用的保存按钮", async ({ page }) => {
  const before = await queryProduct({ page, query: "WBH-2026-BLK" });
  const currentPrice = before.products[0].price;
  const result = await updateProductPrice({ page, sku: "WBH-2026-BLK", price: currentPrice });

  expect(result.success).toBe(true);
  expect(result.products[0].price).toBe(currentPrice);
});

test("库存相同时不会点击禁用的保存按钮", async ({ page }) => {
  const before = await queryProduct({ page, query: "WBH-2026-BLK" });
  const currentStock = before.products[0].stock;
  const result = await updateProductStock({ page, sku: "WBH-2026-BLK", stock: currentStock });

  expect(result.success).toBe(true);
  expect(result.products[0].stock).toBe(currentStock);
});

test("重复设置当前上下架状态不会反向切换", async ({ page }) => {
  const before = await queryProduct({ page, query: "HUB-7IN1-GRY" });
  const currentStatus = before.products[0].status;
  const result = await activateProduct({
    page,
    sku: "HUB-7IN1-GRY",
    active: currentStatus === "已上架",
  });

  expect(result.success).toBe(true);
  expect(result.products[0].status).toBe(currentStatus);
});

test("退款订单返回结构化数据而不是截图", async ({ page }) => {
  const result = await openRefundOrders({ page });

  expect(result.success).toBe(true);
  expect(result.count).toBeGreaterThan(0);
  expect(result.refunds[0]).toEqual(expect.objectContaining({
    id: expect.any(String),
    order: expect.any(String),
    product: expect.any(String),
    amount: expect.any(String),
    status: expect.any(String),
  }));
  expect(result).not.toHaveProperty("screenshotPath");
});

test("退货报表会映射为退款报表", async ({ page }) => {
  const result = await downloadReport({ page, type: "退货报表", range: "本月" });
  try {
    expect(result.success).toBe(true);
    expect(result.type).toBe("退款报表");
    expect(result.range).toBe("本月");
    const file = await fs.stat(result.filePath);
    expect(file.isFile()).toBe(true);
  } finally {
    await fs.rm(result.filePath, { force: true });
  }
});

test("非法报表类型会立即列出可选值", async ({ page }) => {
  await expect(downloadReport({ page, type: "库存报表", range: "本月" }))
    .rejects.toThrow("可选值：销售报表、商品报表、退款报表");
});

test("写入任务会在打开页面前拒绝非法数值", async ({ page }) => {
  await expect(updateProductPrice({ page, sku: "WBH-2026-BLK", price: -1 }))
    .rejects.toThrow("非负 price");
  await expect(updateProductStock({ page, sku: "WBH-2026-BLK", stock: 1.5 }))
    .rejects.toThrow("非负整数 stock");
});

test("空查询条件会返回全部商品", async ({ page }) => {
  const result = await queryProduct({ page });

  expect(result.success).toBe(true);
  expect(result.query).toBe("");
  expect(result.statusFilter).toBe("全部");
  expect(result.count).toBe(4);
});

test("商品查询支持按上下架状态筛选", async ({ page }) => {
  const listed = await queryProduct({ page, status: "已上架" });
  const unlisted = await queryProduct({ page, query: "", status: "已下架" });

  expect(listed.count).toBe(3);
  expect(listed.products.every((product) => product.status === "已上架")).toBe(true);
  expect(unlisted.count).toBe(1);
  expect(unlisted.products[0]).toMatchObject({ sku: "HUB-7IN1-GRY", status: "已下架" });
});

test("修改不存在的商品会返回明确错误", async ({ page }) => {
  await expect(updateProductPrice({ page, sku: "NOT-FOUND", price: 10 }))
    .rejects.toThrow("未找到 SKU：NOT-FOUND");
});

test("错误的登录凭据不会进入卖家平台", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByTestId("login-email").fill("wrong@example.com");
  await page.getByTestId("login-password").fill("wrong-password");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".login-error")).toContainText("账号或密码不正确");
});

test("损坏的本地商品数据会被清理并回退到种子数据", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.evaluate(() => {
    localStorage.setItem("seller-demo-auth", "true");
    localStorage.setItem("seller-demo-auth-expires", String(Date.now() + 60_000));
    localStorage.setItem("seller-demo-products", "{broken-json");
  });
  await page.goto("http://localhost:3000/products");

  await expect(page.getByTestId("product-search")).toBeVisible();
  await expect(page.locator(".product-table tbody tr")).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("seller-demo-products"))).toBeNull();
});

test("会话到期后会返回登录页并提示原因", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.evaluate(() => {
    localStorage.setItem("seller-demo-auth", "true");
    localStorage.setItem("seller-demo-auth-expires", String(Date.now() + 1_500));
  });
  await page.goto("http://localhost:3000/products");
  await expect(page.getByTestId("product-search")).toBeVisible();

  await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
  await expect(page.locator(".login-error")).toContainText("登录已过期");
});
