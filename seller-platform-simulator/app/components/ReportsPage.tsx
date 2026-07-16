"use client";

import { useState } from "react";
import PortalShell, { addOperation } from "./PortalShell";
import { reports } from "./portalData";

export function ReportsPage() {
  const [type, setType] = useState("销售报表");
  const [range, setRange] = useState("本月");
  const [message, setMessage] = useState("");
  const download = (name = type) => { const csv = "\ufeff报表类型,时间范围,生成时间\n" + `${name},${range},2026-07-15 14:35`; const url = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name}-${range}.csv`; anchor.click(); URL.revokeObjectURL(url); addOperation("下载报表", name, range); setMessage(`${name}已下载`); };

  return <PortalShell title="报表中心" subtitle="生成并下载店铺经营数据报表"><section className="report-download-grid"><article className="panel report-config"><div className="panel-head"><div><h2>生成报表</h2><p>选择类型和统计周期</p></div></div><div className="form-stack"><label>报表类型<select data-testid="report-type" value={type} onChange={(event) => setType(event.target.value)}>{reports.map((report) => <option key={report.name}>{report.name}</option>)}</select></label><label>统计周期<select value={range} onChange={(event) => setRange(event.target.value)}><option>今天</option><option>过去 7 天</option><option>本月</option><option>上月</option></select></label><button data-testid="download-report" className="primary-button" onClick={() => download()}>↓ 下载报表</button>{message && <div className="inline-success">✓ {message}</div>}</div></article><article className="panel available-reports"><div className="panel-head"><div><h2>可下载报表</h2><p>CSV 格式，可使用 Excel 打开</p></div></div>{reports.map((report) => <div key={report.name}><span>▤</span><div><strong>{report.name}</strong><small>{report.desc} · {report.size}</small></div><button onClick={() => download(report.name)}>下载</button></div>)}</article></section><section className="panel report-history"><div className="panel-head"><div><h2>最近下载记录</h2><p>近 30 天生成的报表</p></div></div><table><thead><tr><th>报表名称</th><th>统计周期</th><th>生成时间</th><th>操作人</th><th>状态</th></tr></thead><tbody><tr><td><strong>销售报表</strong></td><td>2026年6月</td><td>2026-07-01 09:12</td><td>seller@example.com</td><td><span className="status success"><i/>已生成</span></td></tr></tbody></table></section></PortalShell>;
}
