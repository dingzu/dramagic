# Dramagic 开发文档

> 本文档记录 Dramagic 项目的所有开发细节，包括功能实现、技术选型、开发过程等。

## 文档更新日期
最后更新：2026-01-28 18:07

## 快速参考
- **快速开始**：查看 `/QUICK_START.md` 获取快速入门指南
- **项目总结**：查看 `/PROJECT_SUMMARY.md` 获取完整项目概览
- **前端启动**：`cd frontend && npm run dev`（端口 5173）
- **后端启动**：`cd backend && npm run dev`（端口 3000）
- **健康检查**：http://localhost:3000/health

## 项目状态
✅ **项目初始化已完成**（2026-01-28）
- 所有基础设施就绪
- 文档系统完整
- 开发环境配置完成
- 依赖全部安装
- 可以开始业务开发

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
（待补充）

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
