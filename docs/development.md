# Dramagic 项目规格文档

> 本文档是 Dramagic 项目的技术规格说明书，记录项目结构、技术栈、配置和功能规格。
> 
> 📝 **开发日志请查看** [changelog.md](./changelog.md)

---

## 快速参考

| 项目 | 说明 |
|------|------|
| 前端启动 | `cd frontend && npm run dev`（端口 5173） |
| 后端启动 | `cd backend && npm run dev`（端口 3000） |
| 健康检查 | http://localhost:3000/health |
| 快速开始 | `/QUICK_START.md` |
| 项目总结 | `/PROJECT_SUMMARY.md` |

---

## 项目结构

```
dramagic/
├── frontend/              # Vue 前端工程（Vercel 部署）
│   ├── src/
│   │   ├── components/    # Vue 组件
│   │   │   ├── Canvas.vue       # 画布组件
│   │   │   ├── TextNode.vue     # 文本节点
│   │   │   ├── VideoNode.vue    # 视频生成节点
│   │   │   ├── Sidebar.vue      # 左侧节点库
│   │   │   ├── Login.vue        # 登录组件
│   │   │   ├── Modal.vue        # 弹窗组件
│   │   │   ├── Playground.vue   # API 测试页面
│   │   │   └── SoraPlatform.vue # Sora 平台组件
│   │   ├── App.vue              # 根组件
│   │   ├── main.js              # 应用入口
│   │   └── style.css            # 全局样式
│   ├── .env.example
│   ├── .env.development
│   ├── package.json
│   └── vercel.json
│
├── backend/               # Node.js 后端工程（Railway 部署）
│   ├── src/
│   │   ├── index.js       # 主入口（路由和中间件）
│   │   └── db.js          # 数据库连接
│   ├── .env.example
│   ├── package.json
│   └── railway.json
│
├── config/                # 共享配置（前后端通用）
│   └── pricing.js         # 价格配置
│
├── docs/                  # 项目文档
│   ├── development.md     # 项目规格（本文件）
│   ├── changelog.md       # 开发日志
│   ├── api.md             # API 文档
│   ├── deployment.md      # 部署文档
│   ├── product.md         # 产品文档
│   └── maas.md            # MaaS 接入文档
│
└── .cursorrules           # Cursor 开发规范
```

---

## 技术栈

### 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.x | 前端框架（Composition API） |
| Vite | 7.x | 构建工具 |
| Socket.IO Client | - | 实时通信 |
| Vercel | - | 部署平台 |

### 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 16 | 运行环境 |
| Express | 4.x | Web 框架 |
| PostgreSQL | - | 数据库（Railway） |
| Socket.IO | - | 实时通信 |
| @fal-ai/client | - | fal.ai SDK |
| Railway | - | 部署平台 |

---

## 功能模块

### 1. 用户认证
- 密码保护访问
- localStorage 保持登录状态
- 默认密码：`Dramagic2026`（可通过环境变量修改）

### 2. 项目管理
- 项目 CRUD 操作
- 画布状态持久化（JSONB）
- 本地缓存与自动保存
- 未完成任务恢复

### 3. 画布编辑器
- 无限画布（点阵背景）
- 节点拖拽定位
- 节点自由缩放
- 多人协同编辑（Socket.IO）

### 4. 节点类型
| 节点 | 说明 |
|------|------|
| TextNode | 文本节点，可编辑内容 |
| VideoNode | Sora 2 视频生成节点，支持切换来源（fal.ai / Comfly 官方优质版 / Comfly Original） |

### 5. AI 视频生成
支持以下 MaaS 服务：
- **fal.ai**：Sora 2 模型（$0.10/秒）
- **Comfly Chat 官方优质版**：OpenAI 官方 Token（¥0.48/秒）
- **Comfly Chat Original版**：Original Token（¥0.876/秒）
- **Comfly Chat 廉价版**：仅在 SoraPlatform 页面支持

### 6. 价格配置
独立配置模块 `config/pricing.js`：
- 美元/人民币双币种
- 可配置汇率（默认 7.25）
- 自动换算功能

---

## 数据库设计

### projects 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR | 项目名称 |
| canvas_state | JSONB | 画布状态 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

## API 接口概览

详见 [api.md](./api.md)

### 认证
- `POST /api/v1/auth/verify` - 密码验证

### 项目管理
- `GET /api/v1/projects` - 项目列表
- `POST /api/v1/projects` - 新建项目
- `GET /api/v1/projects/:id` - 获取项目
- `PUT /api/v1/projects/:id` - 更新项目
- `DELETE /api/v1/projects/:id` - 删除项目

### 价格配置
- `GET /api/v1/pricing` - 获取价格列表
- `GET /api/v1/pricing/exchange-rate` - 获取汇率
- `GET /api/v1/pricing/calculate` - 计算费用

### AI 视频生成
- `POST /api/v1/ai/comfly/sora-2/generations` - Comfly 创建任务
- `GET /api/v1/ai/comfly/sora-2/generations/:taskId` - Comfly 查询状态
- `POST /api/v1/ai/fal/sora-2/text-to-video` - fal.ai 创建任务
- `GET /api/v1/ai/fal/sora-2/text-to-video/:requestId` - fal.ai 查询状态

---

## 环境变量

### 前端 (.env)
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_ENV=development
```

### 后端 (.env)
```env
# 服务配置
PORT=3000
NODE_ENV=development
API_VERSION=v1

# 数据库
DATABASE_URL=postgresql://...

# 认证
APP_PASSWORD=Dramagic2026

# Comfly Chat
COMFLY_BASE_URL=https://ai.comfly.chat
COMFLY_API_KEY=sk-xxx          # 廉价版
COMFLY_API_KEY_PREMIUM=sk-xxx  # 官方版
COMFLY_API_KEY_ORIGINAL=sk-xxx # Original版

# fal.ai
FAL_KEY=xxx:xxx
```

---

## 数据库配置

### Railway Postgres（推荐）
1. 在 Railway 创建 PostgreSQL 实例
2. 复制 `DATABASE_URL`
3. 配置到 `backend/.env`

### 本地 Postgres
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dramagic
PGSSLMODE=disable
```

---

## 部署配置

### 前端（Vercel）
- 配置文件：`frontend/vercel.json`
- 构建命令：`npm run build`
- 输出目录：`dist`
- 路由模式：SPA 重写规则

### 后端（Railway）
- 配置文件：`backend/railway.json`
- 启动命令：`npm start`
- 构建工具：NIXPACKS
- 重启策略：失败时重启（最多 10 次）

---

## UI 设计规范

### 配色
| 用途 | 颜色 |
|------|------|
| 背景 | #f8fafc |
| 点阵 | #cbd5e1 |
| 卡片 | #ffffff |
| 边框 | #e2e8f0 |
| 主色 | #3b82f6 |

### 样式
- 圆角：12px
- 阴影：柔和投影
- 风格：Silicon Valley 极简风

---

## 相关文档

- [API 文档](./api.md) - 接口详细说明
- [部署文档](./deployment.md) - 部署指南
- [产品文档](./product.md) - 产品说明
- [MaaS 文档](./maas.md) - MaaS 服务接入
- [开发日志](./changelog.md) - 每日开发进度
