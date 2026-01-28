# Dramagic 开发文档

> 本文档记录 Dramagic 项目的所有开发细节，包括功能实现、技术选型、开发过程等。

## 文档更新日期
最后更新：2026-01-29

## 快速参考
- **快速开始**：查看 `/QUICK_START.md` 获取快速入门指南
- **项目总结**：查看 `/PROJECT_SUMMARY.md` 获取完整项目概览
- **前端启动**：`cd frontend && npm run dev`（端口 5173）
- **后端启动**：`cd backend && npm run dev`（端口 3000）
- **健康检查**：http://localhost:3000/health

## 项目状态
✅ **密码保护功能已完成**（2026-01-28）
- 🔐 访问密码保护
- 🔑 登录页面和验证
- 💾 登录状态保持
- 🚪 退出登录功能

✅ **前端画布编辑器优化完成**（2026-01-28）
- 全新的画布式节点编辑器界面
- 支持文本节点和视频生成节点
- 自动轮询机制（200秒后开始，每5秒轮询）
- 按视频长度计费（$0.1/秒视频）
- 200秒倒计时进度条
- 拖拽性能优化
- 视频尺寸限制
- 按钮状态智能显示
- 纯白风格 UI 设计
- Playground 测试页面

---

## 最新更新

### 2026-01-29 - 项目管理功能（Project）与数据库接入（Railway Postgres）

#### 功能特性
1. **项目列表**
   - 左侧栏新增「项目」面板，可查看所有项目（按最近更新时间排序）。
   - 支持点击项目打开，并将项目中保存的画布状态加载回画布。

2. **新建 / 保存 / 关闭项目**
   - **新建项目**：创建后进入**空白画布**（避免把临时画布误保存进新项目）。
   - **保存项目**：手动保存当前画布状态到当前项目（写入数据库）。
   - **关闭项目**：关闭当前项目并清空画布（仅前端状态，不删除数据库数据）。

3. **画布状态持久化**
   - 后端将画布状态以 `JSONB` 存储在 `projects.canvas_state` 中，便于后续扩展与版本兼容。
   - **未完成任务恢复**：如果视频节点在保存时仍处于 `queued/in_progress` 且有 `requestId`，重新打开项目后会自动继续轮询直到完成。

4. **编辑权限约束**
   - 未打开项目时，节点库将禁用（需要先新建或打开项目）。

5. **本地缓存与自动保存**
   - 打开项目后会在本地保存画布快照（localStorage），用于断网/刷新恢复。
   - 画布变更会触发**自动保存**：本地更频繁保存，后端保存会做防抖（避免频繁请求）。

#### 后端接口（API）
- **项目列表**：`GET /api/v1/projects`
- **新建项目**：`POST /api/v1/projects`（body: `{ name, canvas_state }`）
- **获取项目**：`GET /api/v1/projects/:id`
- **更新项目**：`PUT /api/v1/projects/:id`（body: `{ name?, canvas_state? }`）
- **删除项目**：`DELETE /api/v1/projects/:id`

---

## 数据库（Postgres）配置与连接指南

### （1）引导：在 Railway 上安装数据库（Postgres）
1. 进入 Railway 控制台，打开你的 **Project**。
2. 点击 **New** → 选择 **Database** → 选择 **PostgreSQL** 创建数据库实例。
3. 创建完成后，进入该 Postgres 服务页，找到 **Connect / Variables**：
   - 复制 `DATABASE_URL`（形如 `postgresql://...`）。

> 说明：Railway Postgres 通常要求 TLS 连接；本项目后端默认启用 SSL（无需额外配置）。

### （2）在本地连接数据库
你有两种推荐方式：

#### A. 本地直接连接 Railway Postgres（推荐，最省事）
1. 在 `backend/.env` 中配置：
   - `DATABASE_URL=<Railway 提供的 DATABASE_URL>`
2. 启动后端：
   - `cd backend && npm run dev`
3. 可用 `psql` 验证连接（可选）：
   - `psql "$DATABASE_URL"`

#### B. 使用本地 Postgres（离线/本地更快）
1. 安装并启动本地 Postgres（略）。
2. 在 `backend/.env` 中配置（示例）：
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dramagic`
   - `PGSSLMODE=disable`
3. 启动后端：
   - `cd backend && npm run dev`

### （3）在 Railway 上连接数据库（让线上后端读写）
1. 在 Railway 的 **后端服务**（Node/Express）里打开 **Variables**。
2. 新增或覆盖环境变量：
   - `DATABASE_URL=<Railway Postgres 的 DATABASE_URL>`
3. 触发一次 redeploy（Railway 通常会自动重启服务）。

#### 数据表说明
后端启动时会自动确保表存在：
- `projects`
  - `id`：自增主键
  - `name`：项目名称
  - `canvas_state`：画布状态（JSONB）
  - `created_at / updated_at`：时间戳

### 2026-01-29 - 无限画布与卡片体验优化

#### 功能特性
1. **画布视觉升级**
   - 采用硅谷风格（Silicon Valley Style）的点阵背景（Dot Grid）。
   - 优化整体配色为极简风格（#f8fafc 背景，#cbd5e1 点阵）。

2. **卡片交互增强**
   - **自由缩放**：VideoNode 和 TextNode 支持 `resize: both`，内容自适应布局。
   - **样式优化**：更细腻的边框（1px #e2e8f0）、圆角（12px）和柔和阴影。
   - **性能优化**：
     - 缩放（resize）时通过 `contain: layout paint` / `will-change` 降低重排重绘范围。
     - 拖拽移动时改用 `transform: translate3d(...)` 代替 `left/top`，并将拖拽更新节流为“每帧最多一次”，显著减少卡顿。
   - **详情查看**：新增“详情”按钮，点击可在弹窗（Modal）中查看完整的 API JSON 响应，方便调试。

3. **问题修复**
   - **错误状态清除**：修复了 VideoNode 在重新生成时旧的错误信息未被清除的问题。
   - **状态同步**：优化了生成流程中的状态重置逻辑。

### 2026-01-29 - 前端 Playground 和节点编辑器优化

#### 功能特性
1. **Playground UI 升级（Silicon Valley 风格）**
   - 采用极简设计，浅灰色背景（#f8fafc），白色卡片，柔和阴影
   - 优化排版和间距，提升阅读体验

2. **卡片交互优化**
   - **支持拖拽**：Playground 中的任务卡片支持上下拖拽排序
   - **支持缩放**：Playground 卡片和 Canvas 视频节点支持自由缩放大小（resize）
   - 添加拖拽手柄视觉提示

3. **问题修复**
   - **错误状态管理**：修复 Playground 中不同卡片共享错误消息导致无法清除的问题，现在每个卡片拥有独立的错误状态
   - **视频节点错误修复**：修复 VideoNode 在重新生成时未清除旧错误信息的问题

4. **查看详情功能**
   - Playground 新增「查看详情」按钮
   - 点击可弹出模态框（Modal）查看完整的 JSON 响应数据，方便调试

5. **轮询策略升级**
   - **智能阶梯轮询**：
     - T+50s：第一次轮询
     - T+100s：第二次轮询
     - T+150s：第三次轮询
     - T+200s：第四次轮询
     - T>200s：每 10s 轮询一次
   - **倒计时显示优化**：
     - 前 200s 显示倒计时（200 -> 0）
     - 超过 200s 后显示正计时（+1, +2, ...）

### 2026-01-28 23:58 - 密码保护功能

#### 功能特性
**问题：** 需要访问控制，限制平台访问权限
**解决：**
- 添加登录页面，用户需输入密码才能访问
- 密码保存在后端环境变量
- 登录状态使用 localStorage 保持
- 添加退出登录功能

#### 技术实现

**1. 后端密码验证接口**
```javascript
// POST /api/v1/auth/verify
app.post('/api/v1/auth/verify', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD || 'Dramagic2026';
  
  if (password === correctPassword) {
    return res.json({
      success: true,
      data: { authenticated: true }
    });
  } else {
    return res.status(401).json({
      success: false,
      error: '密码错误'
    });
  }
});
```

**2. 前端登录组件**
- 文件：`frontend/src/components/Login.vue`
- 精美的登录界面（渐变背景、卡片设计）
- 动画效果（滑入、抖动）
- 支持回车键提交

**3. 状态管理**
- 使用 `localStorage.setItem('dramagic_authenticated', 'true')`
- 页面加载时检查登录状态
- 退出登录清除状态

**4. 环境配置**
```env
# backend/.env
APP_PASSWORD=Dramagic2026
```

#### 默认密码
- **密码：** `Dramagic2026`
- 可通过修改 `backend/.env` 中的 `APP_PASSWORD` 更改

---

## 历史更新

### 2026-01-28 23:40 - 按钮状态优化

### 2026-01-28 23:35 - 性能优化和 UX 改进

#### 拖拽性能优化
**问题：** 节点拖拽不跟手，卡顿
**解决：**
- 使用 `requestAnimationFrame` 优化渲染性能
- 拖拽时禁用 `transition` 动画
- 添加拖拽状态视觉反馈（半透明）

#### 视频尺寸限制
**问题：** 视频会把节点撑得很大
**解决：**
- 节点最大宽度限制为 400px
- 视频容器最大高度 200px
- 使用 `object-fit: contain` 保持比例

#### 计费逻辑修正
**问题：** 之前按生成时间计费不准确
**解决：**
- 改为按视频长度计费：视频时长 × $0.1
- 4秒 = $0.40，8秒 = $0.80，12秒 = $1.20

#### 倒计时进度条
**问题：** 200秒等待时间长，用户焦虑
**解决：**
- 添加 200 秒倒计时显示
- 实时更新进度条（0% → 100%）
- 显示剩余秒数
- 蓝色渐变主题设计

---

## 历史更新

### 2026-01-28 20:30 - 前端重构

### 前端重构 - 画布编辑器

#### 功能特性
1. **空白画布**
   - 打开页面后展示空白画布
   - 网格背景，纯白风格设计
   - 提示用户从左侧添加节点

2. **左侧节点库**
   - 文本节点（📝）：用于添加文本内容
   - Sora 2 视频节点（🎬）：AI 文生视频功能
   - 点击即可添加到画布

3. **文本节点**
   - 支持自由拖拽定位
   - 可编辑文本内容
   - 选中高亮效果
   - 可删除节点

4. **Sora 2 视频生成节点**
   - 使用 fal.ai 的 Sora 2 模型
   - 输入描述词（prompt）
   - 可选时长：4秒、8秒、12秒
   - 自动轮询机制：
     - 创建任务后等待 200 秒
     - 然后每 5 秒轮询一次状态
   - 实时费用计算（每秒 $0.1）
   - 状态显示：
     - 待生成（idle）
     - 创建中（creating）
     - 排队中（queued）
     - 生成中（in_progress）
     - 已完成（completed）
     - 生成失败（failed）
   - 视频渲染：生成完成后直接在节点上显示视频播放器

5. **Playground 测试页面**
   - 右上角 Tab 切换
   - 测试 Comfly Chat API
   - 测试任务创建和查询功能

#### 组件架构
```
frontend/src/
├── App.vue              # 主应用，包含顶部导航和 Tab 切换
├── components/
│   ├── Canvas.vue       # 画布组件，管理所有节点
│   ├── TextNode.vue     # 文本节点组件
│   ├── VideoNode.vue    # 视频生成节点组件
│   ├── Sidebar.vue      # 左侧节点库
│   ├── Playground.vue   # API 测试页面
│   └── SoraPlatform.vue  # Sora 视频生成平台组件（支持 Comfly Chat 和 fal.ai）
├── style.css            # 全局样式（纯白风格）
└── main.js
```

#### 技术实现

**1. 节点拖拽**
- 使用 `mousedown` + `mousemove` + `mouseup` 事件
- 实时更新节点位置
- 拖拽时自动选中节点

**2. 轮询机制**
```javascript
// 200秒后开始轮询
setTimeout(() => {
  startPolling(requestId, startTime)
}, 200000)

// 每5秒轮询一次
const pollTimer = setInterval(async () => {
  // 查询任务状态
  // 更新节点数据
  // 计算费用
}, 5000)
```

**3. 费用计算**
```javascript
const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
const cost = (elapsedSeconds * 0.1).toFixed(2)
```

**4. 状态管理**
- 使用 Vue 3 的 `ref` 和 `reactive` 进行状态管理
- 父子组件通过 `emit` 通信
- 节点数据统一在 Canvas 组件中管理

#### UI 设计
- **纯白风格**：
  - 背景：纯白 `#ffffff`
  - 画布网格：浅灰色网格 `rgba(0, 0, 0, 0.03)`
  - 节点：白色卡片，浅灰色边框
  - 选中状态：蓝色边框 `#3b82f6`
  - 阴影：柔和的投影效果

- **交互反馈**：
  - 节点悬停效果
  - 选中高亮
  - 按钮状态变化
  - 过渡动画

---

## 项目初始化

### 创建时间
2026-01-28

### 项目结构
```
dramagic/
├── frontend/          # Vue 前端工程（Vercel）
├── backend/           # Node.js 后端工程（Railway）
├── docs/              # 项目文档
│   ├── product.md     # 产品文档
│   ├── development.md # 开发文档（本文件）
│   ├── api.md         # API 文档
│   └── deployment.md  # 部署文档
└── .cursorrules       # Cursor 开发规范
```

---

## 技术栈

### 前端技术栈
- **框架**: Vue 3
- **构建工具**: Vite
- **部署平台**: Vercel
- **开发语言**: JavaScript/TypeScript

### 后端技术栈
- **运行环境**: Node.js
- **框架**: Express
- **部署平台**: Railway
- **开发语言**: JavaScript

---

## 开发环境配置

### 前端环境要求
- Node.js >= 16
- npm >= 8

### 后端环境要求
- Node.js >= 16
- npm >= 8

---

## 开发记录

### 2026-01-28
#### 项目初始化
- [x] 创建项目基础结构
- [x] 创建产品文档
- [x] 创建开发文档
- [x] 创建 Cursor 开发规范文档
- [x] 初始化 Vue 前端工程
- [x] 初始化 Node.js 后端工程
- [x] 安装前后端依赖

#### 前端工程详情
**创建方式**：
- 使用 `npm create vite@latest` 创建 Vue 3 项目
- 模板：vue (JavaScript)

**目录结构**：
```
frontend/
├── public/              # 静态资源目录
├── src/
│   ├── assets/          # 资源文件（CSS、图片等）
│   ├── components/      # Vue 组件
│   ├── App.vue          # 根组件
│   └── main.js          # 应用入口
├── .env.example         # 环境变量示例
├── .env.development     # 开发环境变量
├── .gitignore          # Git 忽略文件
├── index.html          # HTML 入口
├── package.json        # 项目配置
├── vercel.json         # Vercel 部署配置
├── vite.config.js      # Vite 配置
└── README.md           # 前端说明文档
```

**已配置功能**：
- Vite 构建工具
- Vue 3 框架
- 环境变量配置（`.env.example`, `.env.development`）
- Vercel 部署配置（`vercel.json`）
- 路由重写规则（单页应用支持）

**已安装依赖**：
- vue: ^3.x
- @vitejs/plugin-vue: ^6.x
- vite: ^7.x

**启动命令**：
```bash
cd frontend
npm run dev      # 开发模式（默认端口 5173）
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
```

**环境变量**：
- `VITE_API_BASE_URL`: 后端 API 地址（开发环境默认 http://localhost:3000）
- `VITE_APP_ENV`: 应用环境标识

#### 后端工程详情
**创建方式**：
- 手动创建项目结构
- 使用 Express 框架
- ES6 模块（type: "module"）

**目录结构**：
```
backend/
├── src/
│   └── index.js         # 主入口文件（包含所有路由和中间件）
├── .env.example         # 环境变量示例
├── .gitignore          # Git 忽略文件
├── package.json        # 项目配置
├── railway.json        # Railway 部署配置
└── README.md           # 后端说明文档
```

**已配置功能**：
- Express 服务器
- CORS 跨域支持
- JSON 请求体解析
- 环境变量配置
- 错误处理中间件
- 健康检查接口

**已实现接口**：
1. `GET /health` - 健康检查接口
   - 返回服务状态、时间戳、环境信息
   
2. `GET /` - 根路由
   - 返回 API 基本信息
   
3. `GET /api/v1/example` - 示例接口
   - 演示 API 接口格式

**已安装依赖**：
- express: ^4.18.2 - Web 框架
- cors: ^2.8.5 - CORS 中间件
- dotenv: ^16.3.1 - 环境变量加载

**启动命令**：
```bash
cd backend
npm start     # 生产模式
npm run dev   # 开发模式（自动重启）
```

**环境变量**：
- `PORT`: 服务端口（默认 3000）
- `NODE_ENV`: 运行环境（development/production）
- `API_VERSION`: API 版本号（v1）

#### 文档系统
**已创建文档**：
1. `.cursorrules` - Cursor 开发规范
   - 文档更新规范（强制要求）
   - 代码提交规范
   - 前后端开发规范
   - 部署规范
   - 版本控制规范

2. `docs/product.md` - 产品文档
   - 产品简介、愿景、核心功能
   - 技术架构说明
   - 产品路线图

3. `docs/development.md` - 开发文档（本文件）
   - 记录所有开发细节
   - 项目结构说明
   - 技术栈清单
   - 开发记录

4. `docs/api.md` - API 文档
   - 接口规范
   - 通用响应格式
   - 接口列表

5. `docs/deployment.md` - 部署文档
   - Vercel 部署指南
   - Railway 部署指南
   - 环境变量配置
   - 部署检查清单

6. `README.md` - 项目主文档
   - 项目概览
   - 快速开始指南
   - 文档导航

#### 部署配置
**前端（Vercel）**：
- 配置文件：`frontend/vercel.json`
- 构建命令：`npm run build`
- 输出目录：`dist`
- 框架：vite
- 路由模式：单页应用（SPA）重写规则

**后端（Railway）**：
- 配置文件：`backend/railway.json`
- 启动命令：`npm start`
- 构建工具：NIXPACKS
- 重启策略：失败时重启（最多 10 次）

#### Git 配置
- 根目录 `.gitignore`：全局忽略规则
- 前端 `.gitignore`：包含环境变量、构建产物等
- 后端 `.gitignore`：包含环境变量、日志等

#### 用户指南文档
**已创建用户友好文档**：
1. `README.md` - 项目主文档
   - 项目概览
   - 快速开始链接
   - 文档导航

2. `QUICK_START.md` - 快速开始指南
   - 新手友好的入门指南
   - 详细的启动步骤
   - 常见问题解答
   - 推荐的依赖和项目结构

3. `PROJECT_SUMMARY.md` - 项目总结
   - 完整的项目概览
   - 已完成工作清单
   - 下一步建议
   - 项目特色说明

4. `CHECKLIST.md` - 项目检查清单
   - 详细的完成度检查
   - 100% 完成状态确认
   - 项目统计数据
   - 下一步行动建议

这四个文档共同构成了完整的项目入口和进度跟踪系统，帮助开发者快速了解和上手项目。

---

## 功能开发记录

### 待开发功能
（待补充）

### 已完成功能
#### 2026-01-28

**1. 接入 Comfly Chat `ai.comfly.chat.sora-2` 视频生成能力**
  - 后端新增环境变量配置：
    - `COMFLY_BASE_URL`：API 基础地址
    - `COMFLY_API_KEY`：廉价版（逆向）Token（¥0.12/次）
    - `COMFLY_API_KEY_PREMIUM`：官方优质版 Token（¥0.48/秒）
    - `COMFLY_API_KEY_ORIGINAL`：Original 版 Token（¥0.876/秒）
  - 后端新增接口：
    - `POST /api/v1/ai/comfly/sora-2/generations`：创建视频生成任务
      - 支持 `token_type` 参数选择使用廉价版或官方优质版
      - 根据不同 token 类型使用不同参数：
        - **廉价版**：使用 `aspect_ratio`, `hd`, `duration`（10/15秒）
        - **官方版**：使用 `size`, `duration`（4秒以上）
    - `GET /api/v1/ai/comfly/sora-2/generations/{taskId}`：查询任务状态（v2 格式）
    - `GET /api/v1/ai/comfly/sora-2/videos/{taskId}`：查询任务状态（OpenAI v1 格式）
  - 前端首页新增三模式控制台：
    - **标签页切换**：廉价版（逆向）/ 官方优质版 / Original 版
    - **廉价版表单**：
      - 输入描述词（prompt）
      - 画面比例（16:9/9:16/1:1）
      - 高清开关（hd）
      - 时长选择（10秒/15秒）
    - **官方版表单**：
      - 输入描述词（prompt）
      - 分辨率选择（1280x720 / 720x1280）
      - 时长输入（4秒以上，按秒计费）
    - **Original 版表单**：
      - 输入描述词（prompt）
      - 分辨率选择（1280x720 / 720x1280）
      - 时长输入（4秒以上，按秒计费）
    - 一键创建任务并显示返回的 `task_id`
    - **查询任务功能**：
      - 支持手动选择 Token 类型（廉价版/官方版/Original版）
      - 支持切换 API 格式（v2 / v1 OpenAI 格式）
      - 根据 `task_id` 查询任务执行进度和视频地址
      - 显示任务状态、进度、视频链接、错误信息等

**2. 接入 fal.ai `fal-ai/sora-2/text-to-video` 视频生成能力**
  - 后端新增依赖：`@fal-ai/client`
  - 后端新增环境变量配置：
    - `FAL_KEY`：fal.ai API Key
  - 后端新增接口：
    - `POST /api/v1/ai/fal/sora-2/text-to-video`：创建视频生成任务
      - 支持参数：prompt, resolution, aspect_ratio, duration, model
      - 使用异步队列方式提交任务
    - `GET /api/v1/ai/fal/sora-2/text-to-video/{requestId}`：查询任务状态
      - 支持查询队列状态和获取完成结果
      - 返回视频 URL、缩略图等信息
  - **前端界面重构**：
    - 采用左右分栏布局（1200px 以下改为上下布局）
    - 左侧：Comfly Chat 三模式（廉价版/官方版/Original版）
    - 右侧：fal.ai 独立表单
    - 每个服务独立的创建和查询功能
  - **特点**：
    - 支持 720p 分辨率
    - 支持 16:9 和 9:16 画面比例
    - 支持 4/8/12 秒时长
    - 支持多个模型版本（sora-2, sora-2-2025-12-08, sora-2-2025-10-06）

---

## API 接口记录

详见 [API 文档](./api.md)

---

## 部署记录

详见 [部署文档](./deployment.md)

---

## 问题与解决方案

### 问题记录
（待补充）

---

## 待办事项

- [ ] 完善产品功能
- [ ] 完善 API 文档
- [ ] 配置前端 Vercel 部署
- [ ] 配置后端 Railway 部署
- [ ] 添加单元测试
- [ ] 添加集成测试

---

## 开发团队

（待补充）

---

## 更新日志

### 2026-01-28
- 项目初始化
- 创建基础文档结构
- 创建前后端工程骨架
