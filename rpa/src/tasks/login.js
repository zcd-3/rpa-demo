import { config } from "../config.js";

export async function login({ page, email = config.email, password = config.password }) {
  await page.goto(`${config.baseUrl}/login`, { waitUntil: "networkidle" });
  const emailInput = page.getByTestId("login-email");
  const passwordInput = page.getByTestId("login-password");
  const submit = page.getByTestId("login-submit");
  await submit.waitFor({ state: "visible" });
  // Vinext 先返回服务端 HTML，再由 React 绑定表单事件；等待水合完成后再提交。
  await page.waitForTimeout(500);
  await emailInput.fill(email);
  await passwordInput.fill(password);
  const navigation = page.waitForURL((url) => url.pathname === "/", { waitUntil: "domcontentloaded" });
  await submit.click();
  await navigation;
  await page.getByTestId("nav-products").waitFor({ state: "visible" });
  return { success: true, url: page.url(), expiresInSeconds: 60 };
}
