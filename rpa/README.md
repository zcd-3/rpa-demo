# Amazon RPA

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
node src/main.js updateProductPrice sku=WBH-2026-BLK price=89.99
node src/main.js updateProductStock sku=WBH-2026-BLK stock=120
node src/main.js activateProduct sku=HUB-7IN1-GRY active=true
node src/main.js downloadReport type=销售报表 range=本月
```

默认使用系统 Microsoft Edge。设置 `.env` 中 `HEADLESS=false` 可观察执行过程。

## 使用 DeepSeek AI

复制 `.env.example` 为 `.env`，并填写 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=你的_API_Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

然后可以用自然语言调用 RPA：

```cmd
node src/ai/agent.js 查询商品 WBH-2026-BLK 的价格和库存
node src/ai/agent.js 把 WBH-2026-BLK 的价格修改为 89.99
node src/ai/agent.js 下载本月销售报表
```

也可以不带任务启动，按照提示输入：

```cmd
node src/ai/agent.js
```

### 查看 AI 执行过程

加上 `--verbose`（或简写 `-v`）可以看到 DeepSeek 调用了哪个工具、参数、耗时和执行状态：

```cmd
node src/ai/agent.js --verbose 查询 USB 商品的情况
```

示例日志：

```text
[verbose] DeepSeek 请求第 1 轮: {"model":"deepseek-v4-flash"}
[verbose] 调用工具 queryProduct: {"arguments":{"query":"USB"}}
[verbose] 工具完成 queryProduct: {"success":true,"durationMs":1250}
```

包含密码、Token、API Key 等名称的参数会被自动隐藏。默认不加 `--verbose` 时，只显示最终回答。

## 运行测试

在 `rpa` 目录执行：

```cmd
cd /d D:\rpa-demo\rpa
npm.cmd test
```

测试会自动启动模拟卖家平台；如果平台已经在 `http://localhost:3000` 运行，则直接复用。测试使用系统 Microsoft Edge，依次验证：

1. 商品查询返回结构化字段。
2. 相同价格不会点击禁用的保存按钮。
3. 相同库存不会点击禁用的保存按钮。
4. 重复设置当前上下架状态不会反向切换。
5. 退款订单返回结构化数据而不是截图。
6. “退货报表”会转换成“退款报表”并成功下载。
7. 非法报表类型会立即返回可选值。

测试代码位于 `tests/rpa.spec.js`。看到 `7 passed` 表示全部通过；失败时终端会显示失败用例和具体原因。测试生成的临时报表会在验证后自动删除。
