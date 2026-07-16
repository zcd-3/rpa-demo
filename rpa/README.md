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

此外还会验证非法数值、全量与状态筛选查询、商品不存在、错误登录、损坏的本地数据、会话到期、配置校验、有限重试、结构化错误、故障诊断文件、幂等指纹、AI 单次确认、多轮上下文传递、上下文裁剪和 AI 主动结束会话。测试代码位于 `tests/rpa.spec.js` 与 `tests/reliability.spec.js`。看到 `25 passed` 表示全部通过；失败时终端会显示失败用例和具体原因。测试生成的临时报表会在验证后自动删除。

## 失败诊断

直接 RPA 或 Agent 任务失败时，会在 `artifacts/<task-id>/` 写入：

- `result.json`：任务 ID、错误码、是否可重试、当前 URL 和元数据。
- `screenshot.png`：失败页面截图（页面可用时）。
- `page.html`：失败时的完整页面 HTML（页面可用时）。

这些文件用于本地排错，已被 Git 忽略。
