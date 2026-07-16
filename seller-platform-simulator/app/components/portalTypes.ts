export type Product = {
  sku: string;
  asin: string;
  name: string;
  price: number;
  stock: number;
  listed: boolean;
};

export type Refund = {
  id: string;
  order: string;
  buyer: string;
  product: string;
  amount: string;
  reason: string;
  status: "待处理" | "已批准" | "退款完成";
  created: string;
  note: string;
};

export type OperationLog = {
  id: number;
  time: string;
  user: string;
  action: string;
  target: string;
  detail: string;
  result: string;
};

export type ReportDefinition = {
  name: string;
  desc: string;
  size: string;
};
