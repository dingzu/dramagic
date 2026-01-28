# Dramagic 部署文档

## 部署架构

### 前端部署（Vercel）
- **平台**: Vercel
- **仓库**: （待配置）
- **构建命令**: `npm run build`
- **输出目录**: `dist`
- **部署分支**: `main`

### 后端部署（Railway）
- **平台**: Railway
- **仓库**: （待配置）
- **启动命令**: `npm start`
- **端口**: 自动分配
- **部署分支**: `main`

---

## 前端部署步骤

### 1. 连接 Vercel
1. 登录 Vercel
2. 导入 Git 仓库
3. 选择 `frontend` 目录作为根目录
4. 配置构建设置：
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 2. 环境变量配置
在 Vercel 项目设置中添加：
```
VITE_API_BASE_URL=https://your-backend.railway.app
```

### 3. 自动部署
- 推送到 `main` 分支自动触发部署
- 查看部署日志确认成功

---

## 后端部署步骤

### 1. 连接 Railway
1. 登录 Railway
2. 新建项目
3. 从 Git 仓库部署
4. 选择 `backend` 目录

### 2. 环境变量配置
在 Railway 项目设置中添加：
```
PORT=8080
NODE_ENV=production
```

### 3. 部署配置
- 确保 `package.json` 中有 `start` 脚本
- Railway 会自动检测 Node.js 项目
- 推送到 `main` 分支自动部署

---

## 部署清单

### 前端部署前检查
- [ ] 环境变量已配置
- [ ] 构建命令正确
- [ ] API 地址已更新
- [ ] 本地构建测试通过

### 后端部署前检查
- [ ] 环境变量已配置
- [ ] 启动命令正确
- [ ] 端口配置正确
- [ ] 依赖已安装完整

---

## 域名配置

### 前端域名
- Vercel 默认域名: `your-project.vercel.app`
- 自定义域名: （待配置）

### 后端域名
- Railway 默认域名: `your-project.railway.app`
- 自定义域名: （待配置）

---

## 监控与日志

### Vercel
- 部署日志: Vercel Dashboard > Deployments
- 运行时日志: Vercel Dashboard > Logs

### Railway
- 部署日志: Railway Dashboard > Deployments
- 运行时日志: Railway Dashboard > Logs

---

## 回滚策略

### Vercel 回滚
1. 进入 Vercel Dashboard
2. 选择 Deployments
3. 找到稳定版本
4. 点击 "Promote to Production"

### Railway 回滚
1. 进入 Railway Dashboard
2. 选择 Deployments 标签
3. 选择之前的稳定部署
4. 点击 "Redeploy"

---

## 部署记录

### 最新部署
（待补充）

### 历史部署
（待补充）
