import { config } from "../config.js";
import { RpaError, toRpaError } from "../errors.js";
import { withRetry } from "../reliability.js";
import { login } from "./login.js";

export async function gotoWithRetry(page, url, options = {}) {
  return withRetry(
    () => page.goto(url, options),
    {
      attempts: config.retryAttempts,
      delayMs: config.retryDelayMs,
      shouldRetry: (error) => toRpaError(error).retryable,
    },
  ).catch((error) => {
    const normalized = toRpaError(error, "PAGE_NAVIGATION_FAILED");
    throw new RpaError("PAGE_NAVIGATION_FAILED", `页面打开失败：${url}。${normalized.message}`, {
      retryable: normalized.retryable,
      cause: normalized,
    });
  });
}

export async function ensureLoggedIn(page) {
  await gotoWithRetry(page, `${config.baseUrl}/`, { waitUntil: "domcontentloaded" });
  // 业务页先渲染加载状态，再由客户端决定显示导航或跳转登录页。
  await page.locator('[data-testid="login-email"], [data-testid="nav-products"]').waitFor({ state: "visible" });
  const loginInput = page.getByTestId("login-email");
  if (await loginInput.isVisible().catch(() => false)) {
    await login({ page });
  }
  await page.getByTestId("nav-products").waitFor({ state: "visible" });
}

export async function openProducts(page) {
  await ensureLoggedIn(page);
  await gotoWithRetry(page, `${config.baseUrl}/products`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("product-search").waitFor({ state: "visible" });
}

export function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}
