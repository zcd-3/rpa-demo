"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  ["/", "⌂", "首页"],
  ["/products", "▦", "商品管理"],
  ["/refunds", "↩", "退款订单"],
  ["/reports", "⌁", "报表中心"],
  ["/logs", "≡", "操作日志"],
] as const;

export function addOperation(action: string, target: string, detail: string) {
  if (typeof window === "undefined") return;
  const old = JSON.parse(localStorage.getItem("seller-demo-logs") || "[]");
  const entry = { id: Date.now(), time: new Date().toLocaleString("zh-CN", { hour12: false }), user: "seller@example.com", action, target, detail, result: "成功" };
  localStorage.setItem("seller-demo-logs", JSON.stringify([entry, ...old].slice(0, 100)));
}

export default function PortalShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const expiresAt = Number(localStorage.getItem("seller-demo-auth-expires") || 0);
    const remaining = expiresAt - Date.now();
    if (localStorage.getItem("seller-demo-auth") !== "true" || remaining <= 0) {
      localStorage.removeItem("seller-demo-auth");
      localStorage.removeItem("seller-demo-auth-expires");
      router.replace("/login");
      return;
    }
    setReady(true);
    const timer = window.setTimeout(() => {
      addOperation("会话超时", "账户", "登录已满 1 分钟，系统要求重新登录");
      localStorage.removeItem("seller-demo-auth");
      localStorage.removeItem("seller-demo-auth-expires");
      sessionStorage.setItem("seller-demo-expired", "true");
      router.replace("/login");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [router]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2000); };
  const logout = () => { addOperation("退出登录", "账户", "用户主动退出演示平台"); localStorage.removeItem("seller-demo-auth"); localStorage.removeItem("seller-demo-auth-expires"); router.push("/login"); };
  if (!ready) return <div className="route-loading">正在进入卖家平台…</div>;
  return <div className="app-shell portal-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><div className="brand-mark">sp</div><div><strong>sellpilot</strong><span>卖家平台</span></div></Link>
      <nav className="nav-list portal-nav"><p>卖家工作台</p>{nav.map(([href, icon, label]) => <Link key={href} href={href} data-testid={`nav-${href === "/" ? "home" : href.slice(1)}`} className={pathname === href ? "nav-item active" : "nav-item"}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav>
      <div className="portal-account"><div className="avatar">LM</div><div><strong>Lin&apos;s Market</strong><small>seller@example.com</small></div><button data-testid="logout" onClick={logout}>退出</button></div>
    </aside>
    <main className="main">
      <header className="topbar portal-topbar"><div className="breadcrumb">卖家平台 <span>/</span> {title}</div><div className="top-actions"><button className="icon-button" onClick={() => notify("暂无新消息")}>✉</button><button className="icon-button notification" onClick={() => notify("有 2 项需要关注")}>♢<i /></button><div className="market-chip">🇺🇸 美国站</div></div></header>
      <div className="content portal-content"><section className="portal-heading"><div><p className="eyebrow">SELLER CENTRAL · US</p><h1>{title}</h1><p>{subtitle}</p></div></section>{children}<footer><span>本地演示平台 · 所有业务操作均为模拟</span><span>2026 SellPilot Seller Central</span></footer></div>
    </main>
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}
