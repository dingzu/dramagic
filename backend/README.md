# Dramagic Backend

Dramagic 后端服务，基于 Node.js + Express 构建。

## 技术栈

- Node.js
- Express
- CORS
- dotenv

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 生产模式
```bash
npm start
```

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

## API 接口

### 健康检查
- **URL**: `/health`
- **方法**: GET
- **描述**: 检查服务健康状态

### 根路由
- **URL**: `/`
- **方法**: GET
- **描述**: API 基本信息

### 示例接口
- **URL**: `/api/v1/example`
- **方法**: GET
- **描述**: 示例 API 接口

## 部署

### Railway 部署
1. 连接 Railway 账号
2. 导入 Git 仓库
3. 配置环境变量
4. 自动部署

详见 [部署文档](../docs/deployment.md)

## 目录结构

```
backend/
├── src/
│   └── index.js      # 主入口文件
├── .env.example      # 环境变量示例
├── .gitignore        # Git 忽略文件
├── package.json      # 项目配置
└── README.md         # 说明文档
```

## 开发规范

请参考项目根目录的 `.cursorrules` 文件。
