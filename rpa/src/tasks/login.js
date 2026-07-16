import { config } from "../config.js";
import { RpaError } from "../errors.js";
import { gotoWithRetry } from "./helpers.js";

export async function login({ page, email = config.email, password = config.password }) {
  await gotoWithRetry(page, `${config.baseUrl}/login`, { waitUntil: "domcontentloaded" });
  const emailInput = page.getByTestId("login-email");
  const passwordInput = page.getByTestId("login-password");
  const submit = page.getByTestId("login-submit");
  await page.locator('[data-testid="login-submit"]:not([disabled])').waitFor({ state: "visible" });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submit.click();
  await Promise.race([
    page.waitForURL((url) => url.pathname === "/", { waitUntil: "domcontentloaded" }),
    page.locator(".login-error").waitFor({ state: "visible" }),
  ]);
  if (new URL(page.url()).pathname !== "/") {
    const message = (await page.locator(".login-error").textContent())?.replace(/^!\s*/, "").trim() || "登录失败";
    throw new RpaError("AUTH_FAILED", message);
  }
  await page.getByTestId("nav-products").waitFor({ state: "visible" });
  return { success: true, url: page.url(), expiresInSeconds: 60 };
}
