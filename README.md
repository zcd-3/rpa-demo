# RPA Demo

一个本地卖家平台与 AI 驱动 RPA 的完整演示项目。项目使用 Playwright 操作模拟卖家后台，并通过 DeepSeek Tool Calls 将自然语言请求映射为受控的自动化任务。

> 本项目只连接仓库内的本地模拟平台，不是亚马逊官方工具，也不直接操作真实 Amazon Seller Central。

## 项目结构

```text
rpa-demo/
├─ seller-platform-simulator/  本地卖家后台，基于 Vinext 与 React
└─ rpa/                        Playwright 自动化与 DeepSeek Agent
   ├─ src/tasks/               登录、查询、改价、改库存、上下架、退款和报表任务
   ├─ src/ai/                  Agent CLI、运行时、会话上下文与 DeepSeek 客户端
   └─ tests/                   Playwright 端到端测试
```

## 已实现功能

- 自动登录本地卖家平台
- 查询全部商品或按名称、SKU、ASIN、已上架/已下架状态筛选
- 修改商品价格与库存，重复设置相同值不会超时
- 上架或下架商品，操作具有幂等性
- 查询退款订单并返回结构化数据
- 下载销售、商品和退款 CSV 报表
- 使用 DeepSeek 将中文自然语言转换为白名单任务调用
- `--verbose` 查看脱敏后的 AI 工具调用、重试、耗时和任务指标
- AI 写操作默认需要确认，并具有调用预算、重复失败保护与幂等去重
- AI 支持多轮对话上下文，可理解最近对话中的商品指代并支持清空/查看历史
- 页面导航有限重试、浏览器会话恢复、结构化错误和失败现场归档
- 持久化 Playwright 浏览器目录，跨进程保留登录和本地商品数据
- 2 个平台构建测试与 25 个 RPA/AI 可靠性测试

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
DEEPSEEK_MODEL=deepseek-v4-pro
```

其余超时、重试和执行预算配置参见 [`rpa/.env.example`](rpa/.env.example)。`.env`、浏览器配置、下载文件、失败现场和依赖目录均已被 Git 忽略。

## 启动模拟平台

在项目根目录启动：

```cmd
cd /d D:\rpa-demo
npm.cmd run dev
```

平台默认地址为 `http://localhost:3000`。

## 直接运行 RPA 任务

打开第二个 CMD 窗口：

```cmd
cd /d D:\rpa-demo\rpa
node src/main.js queryProduct query=WBH-2026-BLK
node src/main.js queryProduct
node src/main.js queryProduct status=已上架
node src/main.js queryProduct query=USB status=已下架
node src/main.js updateProductPrice sku=WBH-2026-BLK price=89.99
node src/main.js updateProductStock sku=WBH-2026-BLK stock=120
node src/main.js activateProduct sku=HUB-7IN1-GRY active=true
node src/main.js openRefundOrders
node src/main.js downloadReport type=退款报表 range=本月
```

直接 RPA 命令严格按参数执行，不经过 AI，因此不会弹出 AI 写操作确认。执行结果包含 `taskId`；失败时还会返回错误码和失败现场目录。

## 使用 DeepSeek Agent

任务可以直接写在命令后，也可以不带参数启动后按照提示输入：

```cmd
cd /d D:\rpa-demo\rpa
node src/ai/agent.js 查询 USB 商品的情况
node src/ai/agent.js 把 WBH-2026-BLK 的价格修改为 89.99
node src/ai/agent.js 下载本月退款报表
node src/ai/agent.js
```

不带任务启动时会进入多轮对话模式。Agent 默认保留最近 8 轮完整上下文，包括用户消息、AI 回答、工具调用和工具结果：

```text
› 查询 WBH-2026-BLK 的价格和库存
...

› 把它的库存改为 120
```

会话命令：`/history` 查看上下文，`/clear` 清空上下文，`/exit` 退出。用户明确说“结束”“再见”“先这样”时，AI 也可以调用受控的 `endConversation` 工具，在给出结束语后自动关闭浏览器并退出。普通任务完成不会结束会话。命令行后直接提供任务时仍是单轮模式。

也可以从项目根目录运行：

```cmd
npm.cmd run agent -- --verbose 查询 USB 商品的情况
```

查看工具选择、脱敏参数和耗时：

```cmd
node src/ai/agent.js --verbose 查询 USB 商品的情况
```

修改价格、库存或上下架属于写操作，默认会在终端要求输入 `yes` 确认。只有在已经核对任务、明确希望无人值守执行时，才使用 `--yes`（或 `-y`）跳过确认：

```cmd
node src/ai/agent.js --verbose --yes 把 WBH-2026-BLK 的价格修改为 89.99
```

多轮对话中，如果 AI 已经询问具体写操作，用户下一轮回答“是的”“确认”或“继续”后，匹配的操作会直接执行，不会再弹第二次 `yes`。终端兜底确认只显示商品、价格、库存或上下架等业务描述，不显示内部工具名。

Agent 只能调用 `toolDefinitions.js` 和 `toolRegistry.js` 中注册的白名单任务，不具备任意命令执行或任意文件操作能力。

## 运行测试

在项目根目录可以统一检查和测试两个子项目：

```cmd
cd /d D:\rpa-demo
npm.cmd run check
npm.cmd test
```

测试会自动启动或复用本地模拟平台。平台构建测试正常结果为 `2 passed`，RPA/AI 测试正常结果为：

```text
25 passed
```

只运行 RPA 测试或打开 Playwright 图形界面：

```cmd
npm.cmd run test:rpa
cd /d D:\rpa-demo\rpa
npm.cmd test -- --ui
```

直接 RPA 或 AI 任务失败时，会在 `rpa/artifacts/<task-id>/` 保存结构化错误、页面截图和 HTML（能够取得页面时），便于复盘现场。完整配置和限制参见 `rpa/.env.example`。

## 数据与限制

- 模拟平台使用浏览器 `localStorage`，没有连接真实后端数据库。
- RPA 使用 `rpa/playwright/.profile` 作为专用持久化浏览器目录。
- 同一浏览器目录不适合被多个 RPA 进程同时使用。
- 自动化测试不会访问 DeepSeek；AI 可靠性测试使用本地模拟响应，不消耗 API 额度。
- 默认仅对 AI 驱动的改价、改库存和上下架进行确认；`--yes` 会跳过该保护。
- 真实网站需要根据实际 HTML、登录机制、分页、弹窗和平台规则重新设计定位与异常处理。

更详细的 RPA 命令说明请参阅 [`rpa/README.md`](rpa/README.md)。
