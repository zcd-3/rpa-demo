"use client";

import Link from "next/link";
import PortalShell from "./PortalShell";

export function DashboardPage() {
  return <PortalShell title="首页" subtitle="查看店铺概况并快速进入日常业务操作"><div className="home-kpis"><Kpi label="在售商品" value="127" note="3 件库存不足" /><Kpi label="待处理退款" value="1" note="需在 24 小时内处理" /><Kpi label="本月销售额" value="US$ 42,680" note="较上月 ↑ 12.5%" /><Kpi label="今日操作" value="18" note="全部执行成功" /></div><div className="portal-home-grid"><section className="panel quick-entry"><div className="panel-head"><div><h2>快捷入口</h2><p>常用卖家操作</p></div></div><div className="quick-grid"><Link href="/products"><span>▦</span><strong>查询商品</strong><small>改价、改库存、上下架</small></Link><Link href="/refunds"><span>↩</span><strong>退款订单</strong><small>查询并查看退款详情</small></Link><Link href="/reports"><span>⌁</span><strong>下载报表</strong><small>销售、商品与退款报表</small></Link><Link href="/logs"><span>≡</span><strong>操作日志</strong><small>追踪后台操作记录</small></Link></div></section><section className="panel pending-list"><div className="panel-head"><div><h2>待处理事项</h2><p>建议优先完成</p></div></div><Link href="/products"><b className="warn-dot">!</b><div><strong>3 件商品库存偏低</strong><small>预计 5 天内售罄</small></div><em>去处理 ›</em></Link><Link href="/refunds"><b className="red-dot">1</b><div><strong>1 个退款申请待审核</strong><small>最晚今日 18:00 前处理</small></div><em>去处理 ›</em></Link><Link href="/reports"><b className="blue-dot">⌁</b><div><strong>月度销售报告可下载</strong><small>已包含截至昨日的数据</small></div><em>去下载 ›</em></Link></section></div><section className="panel activity-panel"><div className="panel-head"><div><h2>今日店铺表现</h2><p>2026年7月15日</p></div></div><div className="simple-chart"><div><span style={{height:"45%"}} /><small>09:00</small></div><div><span style={{height:"62%"}} /><small>11:00</small></div><div><span style={{height:"52%"}} /><small>13:00</small></div><div><span style={{height:"84%"}} /><small>15:00</small></div><div><span style={{height:"72%"}} /><small>17:00</small></div><div><span style={{height:"92%"}} /><small>19:00</small></div></div></section></PortalShell>;
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
