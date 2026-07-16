"use client";

import { useEffect, useState } from "react";
import PortalShell, { addOperation } from "./PortalShell";
import { seedProducts } from "./portalData";
import { readStoredProducts } from "./portalStorage";
import type { Product } from "./portalTypes";

export function ProductsPage() {
  const [items, setItems] = useState(seedProducts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = readStoredProducts();
    if (stored.length > 0) window.setTimeout(() => setItems(stored), 0);
  }, []);

  const shown = items.filter((product) => `${product.sku} ${product.asin} ${product.name}`.toLowerCase().includes(query.toLowerCase()) && (status === "全部" || (status === "已上架" ? product.listed : !product.listed)));
  const update = (sku: string, field: "price" | "stock", value: number) => { setItems((old) => old.map((product) => product.sku === sku ? { ...product, [field]: value } : product)); setDirty((old) => ({ ...old, [sku]: true })); setSaved((old) => ({ ...old, [sku]: false })); };
  const save = (product: Product) => { localStorage.setItem("seller-demo-products", JSON.stringify(items)); addOperation("修改商品", product.sku, `价格 US$ ${product.price.toFixed(2)}，库存 ${product.stock}`); setDirty((old) => ({ ...old, [product.sku]: false })); setSaved((old) => ({ ...old, [product.sku]: true })); setMessage(`${product.sku} 的修改已保存，刷新页面后仍会保留`); window.setTimeout(() => setMessage(""), 2600); };
  const toggle = (sku: string) => { setItems((old) => { const next = old.map((product) => { if (product.sku !== sku) return product; addOperation(product.listed ? "下架商品" : "上架商品", sku, product.name); return { ...product, listed: !product.listed }; }); localStorage.setItem("seller-demo-products", JSON.stringify(next)); return next; }); setSaved((old) => ({ ...old, [sku]: true })); };

  return <PortalShell title="商品管理" subtitle="查询商品并修改价格、库存及销售状态"><section className="panel product-panel"><div className="product-toolbar"><label><span>⌕</span><input data-testid="product-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入商品名称、SKU 或 ASIN" /></label><select data-testid="product-status" value={status} onChange={(event) => setStatus(event.target.value)}><option>全部</option><option>已上架</option><option>已下架</option></select><button className="primary-button" onClick={() => setMessage(`查询到 ${shown.length} 件商品`)}>查询商品</button></div>{message && <div className="inline-success">✓ {message}</div>}<div className="table-wrap"><table className="product-table"><colgroup><col className="col-product"/><col className="col-sku"/><col className="col-price"/><col className="col-stock"/><col className="col-status"/><col className="col-actions"/></colgroup><thead><tr><th>商品信息</th><th>SKU / ASIN</th><th>价格（US$）</th><th>可售库存</th><th>销售状态</th><th>操作</th></tr></thead><tbody>{shown.map((product, index) => <tr key={product.sku} className={dirty[product.sku] ? "product-row-dirty" : ""}><td><div className="product-info-cell"><div className={`product-thumb p${index + 1}`}>{["🎧","☕","▱","⌘"][index]}</div><span><strong>{product.name}</strong><small>{product.listed ? "可在前台购买" : "当前不对买家展示"}</small></span></div></td><td><code>{product.sku}</code><small>{product.asin}</small></td><td><input data-testid={`price-${product.sku}`} className="cell-input price-input" type="number" min="0" step="0.01" value={product.price} onChange={(event) => update(product.sku, "price", Number(event.target.value))} /></td><td><input data-testid={`stock-${product.sku}`} className="cell-input stock-input" type="number" min="0" value={product.stock} onChange={(event) => update(product.sku, "stock", Number(event.target.value))} /><small className={product.stock < 10 ? "stock-warn" : ""}>{product.stock < 10 ? "库存预警" : "库存正常"}</small></td><td><span className={`listing ${product.listed ? "online" : "offline"}`}><i />{product.listed ? "已上架" : "已下架"}</span></td><td><div className="product-actions"><div className="row-buttons"><button data-testid={`save-${product.sku}`} className={dirty[product.sku] ? "save-pending" : ""} disabled={!dirty[product.sku]} onClick={() => save(product)}>{dirty[product.sku] ? "保存修改" : "已保存"}</button><button data-testid={`toggle-${product.sku}`} className={product.listed ? "danger" : "publish"} onClick={() => toggle(product.sku)}>{product.listed ? "下架" : "上架"}</button></div><small className={dirty[product.sku] ? "save-state pending" : "save-state"}>{dirty[product.sku] ? "● 有未保存修改" : saved[product.sku] ? "✓ 刚刚已保存" : "✓ 数据已保存"}</small></div></td></tr>)}</tbody></table></div></section></PortalShell>;
}
