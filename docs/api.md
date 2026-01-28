# Dramagic API 文档

## 接口概述
本文档记录 Dramagic 后端 API 的所有接口定义。

## 基础信息
- **Base URL**: `https://your-api-domain.railway.app`
- **API 版本**: v1
- **数据格式**: JSON

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

## 接口列表

### 1. 健康检查
- **路径**: `GET /health`
- **描述**: 检查服务健康状态
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-28T00:00:00.000Z"
  }
}
```

---

（待补充更多接口）
