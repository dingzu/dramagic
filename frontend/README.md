# Dramagic Frontend

Dramagic 前端项目，基于 Vue 3 + Vite 构建。

## 技术栈

- Vue 3
- Vite
- JavaScript

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览生产构建
```bash
npm run preview
```

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

### 环境变量说明
- `VITE_API_BASE_URL`: 后端 API 地址
- `VITE_APP_ENV`: 应用环境

## 部署

### Vercel 部署
1. 连接 Vercel 账号
2. 导入 Git 仓库
3. 选择 `frontend` 目录
4. 配置环境变量
5. 自动部署

详见 [部署文档](../docs/deployment.md)

## 项目结构

```
frontend/
├── public/           # 静态资源
├── src/              # 源代码
│   ├── assets/       # 资源文件
│   ├── components/   # Vue 组件
│   ├── App.vue       # 根组件
│   └── main.js       # 入口文件
├── .env.example      # 环境变量示例
├── .gitignore        # Git 忽略文件
├── index.html        # HTML 模板
├── package.json      # 项目配置
├── vercel.json       # Vercel 配置
└── vite.config.js    # Vite 配置
```

## 开发规范

请参考项目根目录的 `.cursorrules` 文件。

## 注意事项

- 环境变量必须以 `VITE_` 开头才能在前端代码中访问
- 修改环境变量后需要重启开发服务器
