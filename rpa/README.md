# 本地卖家平台 RPA

面向本地 `seller-platform-simulator` 的 Playwright 自动化脚本。

## 运行

先启动卖家平台：

```cmd
cd /d D:\rpa-demo\seller-platform-simulator
npm.cmd run dev
```

另开一个 CMD 窗口运行 RPA：

```cmd
cd /d D:\rpa-demo\rpa
node src/main.js login
node src/main.js openRefundOrders
node src/main.js queryProduct query=WBH-2026-BLK
node src/main.js queryProduct
node src/main.js queryProduct status=已上架
node src/main.js queryProduct query=USB status=已下架
node src/main.js updateProductPrice sku=WBH-2026-BLK price=89.99
node src/main.js updateProductStock sku=WBH-2026-BLK stock=120
node src/main.js activateProduct sku=HUB-7IN1-GRY active=true
node src/main.js downloadReport type=销售报表 range=本月
```

默认使用系统 Microsoft Edge。设置 `.env` 中 `HEADLESS=false` 可观察执行过程。

直接命令不经过 AI，传入的写操作参数会在校验通过后立即执行。成功结果包含 `taskId`；失败结果包含稳定的错误码、是否可重试以及失败现场目录。

`queryProduct` 的 `query` 和 `status` 都是可选参数：

- 不传参数或传入 `query=`：返回全部商品。
- `status=已上架`：只返回已上架商品。
- `status=已下架`：只返回已下架商品。
- `query=USB status=已上架`：同时按关键词和状态筛选。

## 配置

复制 `.env.example` 为 `.env`。常用配置如下：

| 配置项 | 默认值 | 作用 |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:3000` | 本地卖家平台地址 |
| `HEADLESS` | `true` | 是否隐藏浏览器窗口 |
| `ACTION_TIMEOUT_MS` | `15000` | Playwright 操作超时 |
| `RPA_RETRY_ATTEMPTS` | `2` | 可恢复导航错误的总尝试次数 |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | Agent 使用的模型 |
| `AI_REQUEST_TIMEOUT_MS` | `30000` | 单次 DeepSeek 请求超时 |
| `AI_MAX_RETRIES` | `2` | DeepSeek 限流、超时或 5xx 的重试次数 |
| `AI_MAX_ROUNDS` | `8` | 单个任务最大模型轮次 |
| `AI_MAX_CONTEXT_TURNS` | `8` | 多轮会话保留的最近完整轮数 |
| `AI_MAX_CONTEXT_CHARS` | `60000` | 发给模型的历史上下文字符上限 |
| `AI_MAX_TOOL_CALLS` | `12` | 单个任务最大工具调用数 |
| `AI_MAX_WRITE_OPERATIONS` | `3` | 单个任务最大写操作数 |
| `AI_REQUIRE_WRITE_CONFIRMATION` | `true` | 是否要求确认 AI 写操作 |

非法 URL、布尔值或数字配置会在启动时立即给出明确错误，不会等到浏览器运行后才失败。

## 通过 stdio MCP 调用

RPA 同时提供本地 MCP server，原有 CLI 和 DeepSeek Agent 调用方式保持不变。MCP server 暴露 `login`、`openRefundOrders`、`queryProduct`、`updateProductPrice`、`updateProductStock`、`activateProduct`、`deactivateProduct` 和 `downloadReport` 八个工具。

MCP 调用不经过 `src/ai/agent.js`。接入 AstrBot 等外部 Agent 时，自然语言理解、工具选择和多轮对话由外部 Agent 负责，MCP server 直接复用 `toolRegistry.js`、参数校验、浏览器会话和 RPA 任务实现，因此不需要配置 `DEEPSEEK_API_KEY`。

```text
外部 Agent ──stdio/JSON-RPC──> RPA MCP server ──> toolRegistry ──> Playwright ──> 卖家平台
```

成功和失败都会返回 JSON 文本及 `structuredContent`；失败结果包含稳定错误码、`taskId` 和故障现场路径。同一 MCP server 进程复用浏览器会话，并串行执行工具，避免多个调用同时操作同一页面。进程退出或 stdin 关闭时会关闭浏览器会话，运行日志只写 stderr，不会污染 JSON-RPC stdout。

### 本地准备

安装依赖并配置 RPA：

```cmd
cd /d D:\rpa-demo\rpa
npm.cmd ci
copy .env.example .env
```

先启动卖家平台：

```cmd
cd /d D:\rpa-demo\seller-platform-simulator
npm.cmd run dev
```

可以独立启动 MCP server 做人工排错，但正常使用 stdio 时应由 MCP client 自动创建该进程，不需要手动保持它运行：

```cmd
cd /d D:\rpa-demo\rpa
npm.cmd run mcp
```

只验证 MCP 协议、工具 Schema 和真实 stdio 子进程入口：

```cmd
cd /d D:\rpa-demo\rpa
npm.cmd run test:mcp
```

## 应用实例：通过 AstrBot 在手机 QQ 操作 RPA

这个实例将手机 QQ 作为对话入口。用户向 QQ 机器人发送自然语言，AstrBot 的 Agent 选择 RPA MCP 工具，MCP server 再通过 Playwright 操作本地卖家平台，最终结果沿原链路回复到 QQ。

```text
手机 QQ
   │  查询或操作指令
   ▼
QQ 机器人 / NapCat
   │  OneBot v11 反向 WebSocket
   ▼
AstrBot Agent
   │  stdio MCP
   ▼
local-seller-rpa
   │  Playwright
   ▼
seller-platform-simulator
```

AstrBot 官方文档：

- [MCP 配置](https://docs.astrbot.app/use/mcp.html)
- [模型函数调用](https://docs.astrbot.app/use/function-calling.html)
- [OneBot v11 与 NapCat 接入](https://docs.astrbot.app/platform/aiocqhttp.html)
- [QQ 官方机器人接入](https://docs.astrbot.app/platform/qqofficial.html)

### 1. 部署方式要求

推荐让 AstrBot、RPA 和卖家平台都直接运行在同一台 Windows 电脑上。AstrBot 点击连接 stdio MCP server 时，会在 AstrBot 所在主机启动 `node` 子进程；因此只有该主机能访问下面的 Node.js 路径、`D:\rpa-demo` 和 Microsoft Edge 时，配置才会生效。

如果 AstrBot 运行在 Docker 容器中，不能直接照抄 Windows 路径：容器内既无法识别 `D:\rpa-demo\...`，通常也不能直接使用宿主机 Edge 和现有 Playwright 用户目录。当前项目只实现了本地 stdio transport；这个实例应使用 Windows 原生 AstrBot。若必须容器化，需要另行准备容器内的源码、Node.js、浏览器和持久目录，或为 RPA 增加远程 Streamable HTTP transport。

### 2. 在 AstrBot 中添加 RPA MCP server

先在 Windows 终端确认 Node.js 的实际位置：

```cmd
where.exe node
```

进入 AstrBot WebUI 的 MCP 管理页面，点击“新增 MCP 服务器”，选择“Stdio 模板”。

服务器名称填写：

```text
local-seller-rpa
```

服务器配置框只填写服务器对象本身，不要粘贴外层的 `mcpServers` 或 `local-seller-rpa` 键：

```json
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": [
    "D:\\rpa-demo\\rpa\\src\\mcp\\server.js"
  ]
}
```

如果 `where.exe node` 返回了其他位置，用返回的绝对路径替换 `command`。MCP server 会按自身文件位置读取 `D:\rpa-demo\rpa\.env`，所以不需要在 AstrBot 中重复填写卖家账号、密码或 DeepSeek API Key。

保存并启用后，检查 AstrBot 控制台和 MCP 工具列表。连接成功时应识别到以下八个工具：

```text
login
openRefundOrders
queryProduct
updateProductPrice
updateProductStock
activateProduct
deactivateProduct
downloadReport
```

还需要在 AstrBot 中配置支持 Function Calling 的模型，并在工具管理中启用这个 MCP server。模型不支持工具调用时，即使 MCP 显示连接成功，也只会生成文字而不会执行 RPA。

### 3. 把 AstrBot 接入 QQ

本地演示可以使用 NapCat 将一个专用 QQ 账号接入 AstrBot：

1. 在 AstrBot WebUI 打开“机器人”，创建 `OneBot v11` 机器人。
2. 启用该机器人，反向 WebSocket 主机填写 `0.0.0.0`，端口使用默认的 `6199`；如果配置 Token，AstrBot 与 NapCat 两端必须一致。
3. 在 NapCat WebUI 打开“网络配置”，新建并启用 `WebSockets 客户端`。
4. AstrBot 与 NapCat 在同一台 Windows 主机时，连接地址填写 `ws://127.0.0.1:6199/ws`。
5. 回到 AstrBot 控制台，确认出现 `aiocqhttp(OneBot v11) 适配器已连接`。
6. 在手机上使用另一个 QQ 账号向机器人账号发送消息，或把机器人账号加入仅供测试的群聊。

不要把 NapCat 或 AstrBot 的管理端口直接暴露到公网。个人 QQ 自动化还可能受到平台规则和账号风控影响，建议使用专用测试账号。面向正式用户部署时，可以改用 QQ 官方机器人；官方 Webhook 方案通常还需要公网 IP、HTTPS 域名、回调配置和 IP 白名单，具体以 AstrBot 与 QQ 开放平台的当前文档为准。

### 4. 配置写操作确认规则

查询工具不会修改平台数据。价格、库存和上下架属于写操作，工具 Schema 和描述会提示 Agent 先确认，但当前 MCP server 不保存跨消息的确认状态，也不会在服务端强制拦截第一次写调用。因此应在 AstrBot 的人格或系统提示词中加入明确规则：

```text
你是卖家平台操作助手。查询操作可以直接执行。
修改价格、修改库存、上架或下架商品前，必须先复述准确的 SKU、当前目标值和即将执行的动作，
并询问用户是否确认。只有用户在下一条消息中明确回复“确认”“是”或同等含义时才能调用写工具。
用户修改了 SKU 或目标值时必须重新确认。不得根据含糊回答执行写操作。
```

这是一层 Agent 行为约束，不是不可绕过的服务端授权机制。不要让不受信任的 QQ 用户访问具备写工具的机器人；需要更强保证时，应在 MCP server 中增加用户身份校验、允许名单和一次性确认令牌。

### 5. 手机 QQ 操作示例

查询商品不需要二次确认：

```text
用户：查询 WBH-2026-BLK 的价格、库存和上下架状态
AstrBot：调用 queryProduct
机器人：WBH-2026-BLK 当前价格为……，库存为……，状态为……
```

修改库存采用两轮确认：

```text
用户：把 WBH-2026-BLK 的库存改为 120
机器人：即将把商品 WBH-2026-BLK 的库存修改为 120，是否确认？
用户：确认
AstrBot：调用 updateProductStock
机器人：库存修改成功，并返回修改后的商品信息。
```

上下架同样需要确认：

```text
用户：下架 HUB-7IN1-GRY
机器人：即将下架商品 HUB-7IN1-GRY，是否确认？
用户：确认
AstrBot：调用 deactivateProduct
机器人：商品已下架。
```

下载报表示例：

```text
用户：下载本月销售报表
AstrBot：调用 downloadReport
机器人：报表已生成，文件保存在运行 RPA 的 Windows 电脑上的 downloads 目录。
```

`downloadReport` 当前只把文件保存到 RPA 主机并返回 `filePath`，不会自动把 CSV 作为 QQ 附件发送。如果需要手机直接收取文件，还要增加 AstrBot 插件或文件发送步骤。

### 6. 常见故障

| 现象 | 排查方法 |
| --- | --- |
| MCP server 无法启动 | 使用 `where.exe node` 核对 `command`；确认 `args` 是绝对路径；在 `rpa` 目录执行 `npm.cmd ci` 和 `npm.cmd run test:mcp`。 |
| 提示找不到模块 | 依赖未安装或 AstrBot 启动了另一份源码；在 `D:\rpa-demo\rpa` 重新执行 `npm.cmd ci`。 |
| MCP 已连接但模型不调用工具 | 检查模型是否支持 Function Calling，并确认 AstrBot 工具管理中已启用 `local-seller-rpa`。 |
| RPA 返回连接拒绝 | 确认 `seller-platform-simulator` 正在运行，且 `.env` 中 `BASE_URL=http://localhost:3000`。 |
| 浏览器用户目录被占用 | 不要同时手动运行多个 `npm.cmd run mcp`；关闭残留 MCP/Edge 进程后让 AstrBot 重新连接。单个 MCP 进程内部已自动串行执行。 |
| NapCat 已运行但 QQ 消息无回复 | 检查 AstrBot 与 NapCat 的端口、Token 和反向 WebSocket URL，并在 AstrBot 控制台确认适配器已连接。 |
| QQ 能查询但不能收到报表文件 | 当前工具只返回 RPA 主机上的文件路径，需要额外实现 AstrBot 文件发送。 |

## 使用 DeepSeek AI

AI 代码按职责拆分：`agent.js` 只负责终端入口，`agentRuntime.js` 负责编排模型与工具，`conversation.js` 管理多轮上下文和待确认操作，`deepseekClient.js` 负责 API 超时与重试，`presentation.js` 负责脱敏日志和自然确认文案。

复制 `.env.example` 为 `.env`，并填写 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=你的_API_Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

然后可以用自然语言调用 RPA：

```cmd
node src/ai/agent.js 查询商品 WBH-2026-BLK 的价格和库存
node src/ai/agent.js 把 WBH-2026-BLK 的价格修改为 89.99
node src/ai/agent.js 下载本月销售报表
```

也可以不带任务启动多轮对话：

```cmd
node src/ai/agent.js
```

Agent 会在同一进程中保留最近若干轮上下文，因此后续可以使用“它”“刚才那个商品”等指代：

```text
› 查询 WBH-2026-BLK 的价格和库存
...

› 把它的库存改为 120
```

上下文按完整轮保存，包括用户消息、AI 工具调用、工具结果和最终回答。达到 `AI_MAX_CONTEXT_TURNS` 或 `AI_MAX_CONTEXT_CHARS` 后，会优先删除最旧的完整轮次，不会拆散工具调用和结果。

交互命令：

- `/history`：查看当前保存的用户问题和 AI 最终回答。
- `/clear`：清空上下文，开始新话题。
- `/exit`：关闭浏览器并退出 Agent。

当用户明确表达“结束”“再见”“先这样”等意图时，AI 可以调用专用的 `endConversation` 会话工具，给出自然结束语后自动关闭浏览器并退出。普通任务完成不会触发退出。

在命令行后直接提供任务时仍是单轮模式，不会跨进程保存上下文。

### 查看 AI 执行过程

加上 `--verbose`（或简写 `-v`）可以看到 DeepSeek 调用了哪个工具、参数、耗时和执行状态：

```cmd
node src/ai/agent.js --verbose 查询 USB 商品的情况
```

示例日志：

```text
[verbose] DeepSeek 请求第 1 轮: {"model":"deepseek-v4-pro"}
[verbose] 调用工具 queryProduct: {"arguments":{"query":"USB"}}
[verbose] 工具完成 queryProduct: {"success":true,"durationMs":1250}
```

包含密码、Token、API Key 等名称的参数会被自动隐藏。默认不加 `--verbose` 时，只显示最终回答。

### 写操作确认与执行预算

修改价格、库存和上下架默认需要在终端输入 `yes` 确认。明确需要无人值守执行时，可以加 `--yes`（或 `-y`）：

```cmd
node src/ai/agent.js --verbose --yes 把 WBH-2026-BLK 的价格修改为 89.99
```

多轮模式使用结构化待确认操作：AI 询问具体修改后，会保存准确的工具参数；用户下一轮回答“是的”“确认”或“继续”时，只有参数完全匹配的写操作才会直接执行，因此不会重复弹出终端确认。如果参数发生变化，仍会重新确认。所有面向用户的确认提示只显示自然业务描述，不暴露内部函数名称。

Agent 会校验工具参数，限制模型轮次、工具调用数和写操作数；对 DeepSeek 的超时、限流和服务端错误进行有限重试，并阻止相同失败工具无限重复。相关上限可在 `.env` 中通过 `AI_MAX_ROUNDS`、`AI_MAX_TOOL_CALLS`、`AI_MAX_WRITE_OPERATIONS` 等变量调整。

相同写操作在一个 Agent 任务内使用稳定参数指纹去重。未确认的写操作不会启动浏览器，也不会调用 RPA 工具。

RPA 失败时会在 `artifacts/<task-id>/` 保存 `result.json`，并在能够取得页面时保存截图和 HTML。

## 运行测试

在 `rpa` 目录执行：

```cmd
cd /d D:\rpa-demo\rpa
npm.cmd test
```

可视化观察全部测试、打开调试器或只运行一个测试：

```cmd
npm.cmd test -- --headed
npm.cmd test -- --debug
npm.cmd test -- --ui
npm.cmd test -- --debug --grep "会话到期"
```

测试会自动启动模拟卖家平台；如果平台已经在 `http://localhost:3000` 运行，则直接复用。测试使用系统 Microsoft Edge，依次验证：

1. 商品查询返回结构化字段，空参数返回全部商品，并支持已上架/已下架筛选。
2. 相同价格不会点击禁用的保存按钮。
3. 相同库存不会点击禁用的保存按钮。
4. 重复设置当前上下架状态不会反向切换。
5. 退款订单返回结构化数据而不是截图。
6. “退货报表”会转换成“退款报表”并成功下载。
7. 非法报表类型会立即返回可选值。

此外还会验证非法数值、全量与状态筛选查询、商品不存在、错误登录、损坏的本地数据、会话到期、配置校验、有限重试、结构化错误、故障诊断文件、幂等指纹、AI 单次确认、多轮上下文传递、上下文裁剪和 AI 主动结束会话。Playwright 测试代码位于 `tests/rpa.spec.js` 与 `tests/reliability.spec.js`；看到 `25 passed` 表示全部通过。MCP 的 5 个独立测试位于 `tests/mcp.test.js`，使用 `npm.cmd run test:mcp` 执行。失败时终端会显示失败用例和具体原因，测试生成的临时报表会在验证后自动删除。

## 失败诊断

直接 RPA 或 Agent 任务失败时，会在 `artifacts/<task-id>/` 写入：

- `result.json`：任务 ID、错误码、是否可重试、当前 URL 和元数据。
- `screenshot.png`：失败页面截图（页面可用时）。
- `page.html`：失败时的完整页面 HTML（页面可用时）。

这些文件用于本地排错，已被 Git 忽略。
