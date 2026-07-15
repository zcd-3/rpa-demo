import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SellPilot · 卖家平台",
  description: "一个用于本地演示和 RPA 测试的电商卖家管理平台。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
