# 灵搜 Lingsou

> 通用网页搜索引擎 | Universal Web Search Engine

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

灵搜是一个用 Node.js + TypeScript 实现的通用网页搜索引擎，前端为极简搜索框，后端基于 Meilisearch 全文索引。爬虫从种子 URL 出发 BFS 抓取并自动索引中文网页，支持自动补全、关键词高亮、本地搜索历史。

![灵搜搜索效果截图](docs/screenshot.png)

## ✨ 特性

- 🔍 **全文检索** — 基于 Meilisearch v1.10，毫秒级响应
- 🈶 **中文分词** — 集成 nodejieba（N-API 原生绑定），索引前预分词
- 🕷️ **BFS 爬虫** — 从种子列表出发广度优先抓取，自动编码检测（UTF-8/GBK）
- 🤖 **robots.txt 友好** — 遵守 robots 协议，礼貌延时（默认 1.5s），UA 标识
- ⚡ **自动补全** — 输入时实时联想，防抖 250ms
- ✨ **关键词高亮** — Meilisearch `<mark>` 标签，前端安全注入
- 📚 **搜索历史** — localStorage 持久化，最多 10 条，一键清除
- 🛡️ **错误处理** — Zod schema 校验，统一错误响应，不泄露 stack
- 🧪 **测试完备** — 72 个单元 + 集成测试，4 个 Playwright E2E

## 🏗️ 架构

```
       Seed URLs
          ↓
   ┌──────────────┐
   │  BFS Crawler │  ← robots.txt + 礼貌延时 + 编码检测
   └──────┬───────┘
          ↓
   ┌──────────────┐
   │   Pipeline   │  ← 抓取 → 提取 → 中文分词 → IndexedDocument
   └──────┬───────┘
          ↓
   ┌──────────────┐
   │ Meilisearch  │  ← 索引存储 + 高亮 + 自动补全
   └──────┬───────┘
          ↓
   ┌──────────────┐
   │  Fastify API │  ← /api/search, /api/suggest, /api/health
   └──────┬───────┘
          ↓
   ┌──────────────┐
   │  Vite SPA    │  ← Tailwind UI + 防抖 + 分页 + 历史
   └──────────────┘
```

## 🚀 快速开始

### 前置要求

- Node.js 20+ (推荐 22 LTS)
- npm 10+
- Meilisearch v1.10 (Docker 或二进制，见下文)
- 可选：Docker (有 Docker 优先用)

### 步骤

```bash
# 1. 克隆
git clone https://github.com/Moon-Spirit/Lingsou.git
cd Lingsou

# 2. 安装依赖 (根 + web 子包)
npm install
npm run web:install

# 3. 启动 Meilisearch
# 选项 A：Docker (推荐)
docker compose up -d

# 选项 B：二进制 (无 Docker 环境)
bash scripts/start-meili.sh  # 自动下载 linux-aarch64 二进制并后台启动

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env，确保 MEILI_KEY 与 scripts/start-meili.sh 一致 (默认 lingsou-dev-key)

# 5. 启动 API (开发模式，热重载)
npm run dev:api

# 6. 启动前端 (另一个终端)
npm run dev:web

# 7. 访问
open http://localhost:5173

# 8. 爬取种子 (可选，首次启动后)
npm run crawl -- --seeds=seeds.txt --max=20 --depth=1
```

### 一键启动（开发模式）

```bash
npm run dev   # 同时启动 meili + api + web (Ctrl+C 一次性停止)
```

## 📜 脚本列表

| 脚本 | 作用 |
|------|------|
| `npm run dev` | 一键启动 meili + api + web |
| `npm run dev:meili` | 启动 Meilisearch |
| `npm run dev:api` | 启动 API (tsx watch，热重载) |
| `npm run dev:web` | 启动前端 (Vite，热重载) |
| `npm run dev:crawl` | 启动爬虫 (watch 模式) |
| `npm run build` | 生产构建 (tsc + vite build) |
| `npm start` | 生产启动 (node dist/api/server.js) |
| `npm run crawl` | 一次性爬取 + 索引 (参数: --seeds --max --depth) |
| `npm test` | 跑所有测试 |
| `npm run test:unit` | 仅跑单元测试 |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npm run test:e2e` | 跑 Playwright E2E |
| `npm run test:e2e:setup` | 安装 Playwright Chromium |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 |

## ⚙️ 配置项（环境变量）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MEILI_HOST` | (必填) | Meilisearch 地址 |
| `MEILI_KEY` | `lingsou-dev-key` | Meilisearch master key |
| `MEILI_INDEX` | `lingsou_pages` | 索引名称 |
| `CRAWL_MAX_PAGES` | `50` | 单次爬取最大页数 |
| `CRAWL_DELAY_MS` | `1500` | 两次请求间隔（毫秒） |
| `CRAWL_USER_AGENT` | `LingsouBot/0.1 ...` | 爬虫 UA |
| `CRAWL_MAX_DEPTH` | `2` | BFS 最大深度 |
| `CRAWL_CONCURRENCY` | `3` | 并发数 |
| `LOG_LEVEL` | `info` | pino 日志级别 |
| `PORT` | `3001` | API 端口 |

## 📁 项目结构

```
Lingsou/
├── src/                     # 后端 TypeScript 源码
│   ├── api/                 # Fastify API
│   │   ├── server.ts        # 入口
│   │   ├── index.ts         # app 工厂
│   │   ├── schemas.ts       # Zod 校验
│   │   ├── errorHandler.ts  # 统一错误处理
│   │   └── routes/          # search / suggest / history
│   ├── crawler/             # BFS 爬虫
│   │   ├── bfs.ts           # 核心 BFS
│   │   ├── fetcher.ts       # undici HTTP
│   │   ├── robots.ts        # robots.txt
│   │   ├── pipeline.ts      # 爬取→索引管线
│   │   ├── normalize.ts     # URL 规范化
│   │   └── seedLoader.ts    # 种子加载
│   ├── meili/               # Meilisearch 客户端
│   ├── tokenizer/           # nodejieba 中文分词
│   ├── types/               # 共享类型
│   ├── utils/               # URL / 编码 / HTML 工具
│   ├── config.ts            # zod env 校验
│   └── logger.ts            # pino 日志
├── web/                     # 前端 (子包)
│   ├── src/
│   │   ├── App.ts           # 根组件
│   │   ├── main.ts          # 入口
│   │   ├── api/             # fetch 封装
│   │   └── components/      # SearchBox / ResultList / HistoryPanel
│   ├── index.html
│   └── vite.config.ts       # proxy /api → 3001
├── tests/
│   ├── integration/         # supertest 真实集成测试
│   └── e2e/                 # Playwright E2E
├── scripts/
│   ├── start-meili.sh       # Meilisearch 启动 (无 Docker)
│   ├── stop-meili.sh
│   ├── wait-for-meili.sh
│   └── smoke.sh             # 端到端冒烟测试
├── seeds.txt                # 种子 URL 列表
├── docker-compose.yml       # Meilisearch Docker
├── package.json
├── tsconfig.json
├── tsconfig.web.json
├── eslint.config.js
├── vitest.config.ts
└── playwright.config.ts
```

## 🛠️ 开发指南

### 新增种子 URL

编辑 `seeds.txt`，每行一个 URL (以 `#` 开头为注释)：

```
# 添加新站点
https://example.com/
```

### 调整爬虫参数

通过环境变量：

```bash
CRAWL_DELAY_MS=3000 CRAWL_MAX_PAGES=100 npm run crawl
```

或在 `.env` 中修改。

### 自定义分词停用词

编辑 `src/tokenizer/jieba.ts` 中的 `STOP_WORDS` Set。

## ❓ 排错 FAQ

### Q: `curl http://localhost:7700/health` 返回 `connection refused`
A: Meilisearch 未启动。运行 `bash scripts/start-meili.sh`（二进制）或 `docker compose up -d`（Docker）。

### Q: `Error: Cannot find module 'nodejieba'`
A: 重新安装：`npm install`（aarch64 上 nodejieba 需源码编译，可能耗时较长）。

### Q: 中文搜索结果乱码
A: 爬虫未正确检测编码。检查 `src/utils/encoding.ts` 的 `detectEncoding`，或手动指定 (GBK/UTF-8)。

### Q: 启动时报 `ZodError: MEILI_HOST` 必填
A: 复制 `.env.example` 为 `.env`，设置 `MEILI_HOST=http://localhost:7700`。

### Q: Docker 不可用
A: 项目自带 `scripts/start-meili.sh` 自动下载 aarch64 Linux 二进制并后台启动，无需 Docker。

### Q: Playwright 启动失败 `Executable doesn't exist`
A: 运行 `npm run test:e2e:setup` 安装 Chromium。

## 📊 性能数据

- 爬取 1 个种子 (infoq.cn 1 页)：~3s
- 中文分词 100KB 文本：<1s
- 索引 100 条文档：Meilisearch 内 <500ms
- 搜索响应时间：<50ms (本地)

## 🧪 测试

```bash
npm test                    # 单元 + 集成 (72 cases)
npm run test:coverage       # 覆盖率报告 (≥79%)
npm run test:e2e            # Playwright E2E (4 cases)
```

## 📄 License

MIT © 2026 Moon-Spirit

## 🙏 致谢

- [Meilisearch](https://www.meilisearch.com/) - 全文搜索
- [nodejieba](https://github.com/yanyiwu/nodejieba) - 中文分词
- [Fastify](https://fastify.dev/) - Web 框架
- [Vite](https://vite.dev/) - 前端构建
- [Tailwind CSS](https://tailwindcss.com/) - UI 框架
- [undici](https://undici.nodejs.org/) - HTTP 客户端
- [robots-parser](https://www.npmjs.com/package/robots-parser) - robots.txt
- [cheerio](https://cheerio.js.org/) - HTML 解析