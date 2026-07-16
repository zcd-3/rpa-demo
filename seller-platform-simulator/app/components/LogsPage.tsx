"use client";

import { useMemo, useState } from "react";
import PortalShell from "./PortalShell";
import { seededLogs } from "./portalData";
import { readStoredLogs } from "./portalStorage";

export function LogsPage() {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("全部操作");
  const shown = useMemo(() => {
    const all = [...readStoredLogs(), ...seededLogs];
    return all.filter((log) => (action === "全部操作" || log.action === action) && `${log.action} ${log.target} ${log.detail}`.toLowerCase().includes(query.toLowerCase()));
  }, [action, query]);

  return <PortalShell title="操作日志" subtitle="查看登录、商品、退款及报表操作记录"><section className="panel logs-panel"><div className="product-toolbar"><label><span>⌕</span><input data-testid="log-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索操作内容或对象" /></label><select value={action} onChange={(event) => setAction(event.target.value)}><option>全部操作</option><option>修改商品</option><option>上架商品</option><option>下架商品</option><option>查看退款详情</option><option>批准退款</option><option>下载报表</option><option>退出登录</option></select><button className="primary-button">查询日志</button></div><div className="log-count">共 {shown.length} 条操作记录</div><div className="table-wrap"><table><thead><tr><th>操作时间</th><th>操作人</th><th>操作类型</th><th>操作对象</th><th>详细信息</th><th>结果</th></tr></thead><tbody>{shown.map((log) => <tr key={log.id}><td>{log.time}</td><td>{log.user}</td><td><strong>{log.action}</strong></td><td><code>{log.target}</code></td><td>{log.detail}</td><td><span className="status success"><i/>{log.result}</span></td></tr>)}</tbody></table></div></section></PortalShell>;
}
