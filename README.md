# RPA Demo

一个本地卖家平台与 AI 驱动 RPA 的完整演示项目。项目使用 Playwright 操作模拟卖家后台，并通过 DeepSeek Tool Calls 将自然语言请求映射为受控的自动化任务。

> 本项目只连接仓库内的本地模拟平台，不是亚马逊官方工具，也不直接操作真实 Amazon Seller Central。

## 项目结构

```text
rpa-demo/
├─ seller-platform-simulator/  本地卖家后台，基于 Vinext 与 React
└─ rpa/                        Playwright 自动化与 DeepSeek Agent
   ├─ src/tasks/               登录、查询、改价、改库存、上下架、退款和报表任务
   ├─ src/ai/                  DeepSeek Tool Calls Agent
   └─ tests/                   Playwright 端到端测试
```

## 已实现功能

- 自动登录本地卖家平台
- 查询商品价格、库存和上下架状态
- 修改商品价格与库存，重复设置相同值不会超时
- 上架或下架商品，操作具有幂等性
- 查询退款订单并返回结构化数据
- 下载销售、商品和退款 CSV 报表
- 使用 DeepSeek 将中文自然语言转换为白名单任务调用
- `--verbose` 查看脱敏后的 AI 工具调用与耗时
- 持久化 Playwright 浏览器目录，跨进程保留登录和本地商品数据
- 7 个项目级 Playwright 测试

## 环境要求

- Windows
- Node.js 22.13 或更高版本
- Microsoft Edge
- DeepSeek API Key（只在使用 AI Agent 时需要）

## 安装依赖

```cmd
cd /d D:\rpa-demo\seller-platform-simulator
npm.cmd ci

cd /d D:\rpa-demo\rpa
npm.cmd ci
```

## 配置 RPA

复制环境变量示例：

```cmd
cd /d D:\rpa-demo\rpa
copy .env.example .env
```

如需使用 DeepSeek，在 `rpa/.env` 中填写自己的 Key：

```env
DEEPSEEK_API_KEY=你的_API_Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

`.env`、浏览器配置、下载文件和依赖目录均已被 Git 忽略。

## 启动模拟平台

打开第一个 CMD 窗口：

```cmd
cd /d D:\rpa-demo\seller-platform-simulator
npm.cmd run dev
```

平台默认地址为 `http://localhost:3000`。

## 直接运行 RPA 任务

打开第二个 CMD 窗口：

```cmd
cd /d D:\rpa-demo\rpa
node src/main.js queryProduct query=WBH-2026-BLK
node src/main.js updateProductPrice sku=WBH-2026-BLK price=89.99
node src/main.js updateProductStock sku=WBH-2026-BLK stock=120
node src/main.js activateProduct sku=HUB-7IN1-GRY active=true
node src/main.js openRefundOrders
node src/main.js downloadReport type=退款报表 range=本月
```

## 使用 DeepSeek Agent

任务可以直接写在命令后，也可以不带参数启动后按照提示输入：

```cmd
cd /d D:\rpa-demo\rpa
node src/ai/agent.js 查询 USB 商品的情况
node src/ai/agent.js 把 WBH-2026-BLK 的价格修改为 89.99
node src/ai/agent.js 下载本月退款报表
node src/ai/agent.js
```

查看工具选择、脱敏参数和耗时：

```cmd
node src/ai/agent.js --verbose 查询 USB 商品的情况
```

Agent 只能调用 `toolDefinitions.js` 和 `toolRegistry.js` 中注册的白名单任务，不具备任意命令执行或任意文件操作能力。

## 运行测试

```cmd
cd /d D:\rpa-demo\rpa
npm.cmd test
```

测试会自动启动或复用本地模拟平台，并验证商品查询、同值更新、上下架幂等、退款数据以及报表下载和错误处理。正常结果为：

```text
7 passed
```

## 数据与限制

- 模拟平台使用浏览器 `localStorage`，没有连接真实后端数据库。
- RPA 使用 `rpa/playwright/.profile` 作为专用持久化浏览器目录。
- 同一浏览器目录不适合被多个 RPA 进程同时使用。
- 真实网站需要根据实际 HTML、登录机制、分页、弹窗和平台规则重新设计定位与异常处理。

更详细的 RPA 命令说明请参阅 [`rpa/README.md`](rpa/README.md)。
