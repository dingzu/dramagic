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

### 2. 密码验证
- **路径**: `POST /api/v1/auth/verify`
- **描述**: 验证访问密码
- **认证**: 无
- **请求参数（JSON Body）**:
  - `password` (string, 必填): 访问密码
- **成功响应示例**:
```json
{
  "success": true,
  "data": {
    "authenticated": true
  },
  "message": "密码验证成功"
}
```
- **失败响应示例**:
```json
{
  "success": false,
  "error": "密码错误"
}
```

**说明：**
- 默认密码：`Dramagic2026`
- 密码存储在后端环境变量 `APP_PASSWORD` 中
- 可通过修改 `backend/.env` 文件更改密码

---

### 3. 创建视频生成任务（ai.comfly.chat.sora-2）

- **路径**: `POST /api/v1/ai/comfly/sora-2/generations`
- **描述**: 通过后端代理调用 Comfly Chat 的 `sora-2` 模型创建视频生成任务
- **认证**: 无（后端使用环境变量中的 `COMFLY_API_KEY` 访问外部服务）
- **请求参数（JSON Body）**:
  
  **通用参数：**
  - `prompt` (string, 必填): 文本描述词
  - `token_type` (string, 可选): Token 类型，默认 `"default"`，可选值：
    - `"default"`: 廉价版（逆向）¥0.12/次
    - `"premium"`: 官方优质版 ¥0.48/秒
    - `"original"`: Original 版 ¥0.876/秒
  - `duration` (string | number, 可选): 时长（秒）
  
  **廉价版参数（token_type="default"）：**
  - `aspect_ratio` (string, 可选): 画面比例，默认 `"16:9"`，可选值：`"16:9"`, `"9:16"`, `"1:1"`
  - `hd` (boolean, 可选): 是否高清，默认 `false`
  - `duration`: 默认 `"10"`，**仅支持 `"10"` 或 `"15"`**
  
  **官方版参数（token_type="premium"）：**
  - `size` (string, 可选): 分辨率，默认 `"1280x720"`，可选值：
    - `"1280x720"`: 720P 横屏
    - `"720x1280"`: 720P 竖屏
  - `duration`: 默认 `"5"`，**支持 4 秒以上，按秒计费**
  
  **Original 版参数（token_type="original"）：**
  - `size` (string, 可选): 分辨率，默认 `"1280x720"`，可选值：
    - `"1280x720"`: 720P 横屏
    - `"720x1280"`: 720P 竖屏
  - `duration`: 默认 `"5"`，**支持 4 秒以上，按秒计费**
- **成功响应示例**:
```json
{
  "success": true,
  "data": {
    "task_id": "f0aa213c-c09e-4e19-a0e5-c698fe48acf1"
  },
  "message": "任务创建成功"
}
```

### 4. 查询视频生成任务（ai.comfly.chat.sora-2）

- **路径**: `GET /api/v1/ai/comfly/sora-2/generations/{taskId}`
- **描述**: 查询已创建的视频生成任务状态和结果
- **路径参数**:
  - `taskId` (string, 必填): 任务 ID（创建任务时返回的 `task_id` 或 `id`）
- **Query 参数**:
  - `token_type` (string, 可选): Token 类型，默认根据 task_id 前缀自动判断
    - `"default"`: 使用廉价版 Token 查询
    - `"premium"`: 使用官方优质版 Token 查询
    - `"original"`: 使用 Original 版 Token 查询
    - **说明**：如果 task_id 包含 `video_` 前缀，会自动使用 premium Token

**响应格式说明：**
- `status`: 任务状态
  - `queued`: 排队中
  - `in_progress`: 进行中
  - `completed`: 已完成
  - `failed`: 失败
- `progress`: 进度（0-100）
- `url` / `video_url`: 视频地址（仅 `completed` 状态）
- `error`: 错误信息（仅 `failed` 状态）

**成功响应示例（进行中）**:
```json
{
  "success": true,
  "data": {
    "id": "video_b9d05dda-0f9d-48c2-944e-7c5b47c6a399",
    "object": "video",
    "model": "sora-2-pro",
    "status": "queued",
    "progress": 0,
    "created_at": 1760679942,
    "seconds": "15",
    "size": "1280x720",
    "error": null,
    "video_url": ""
  },
  "message": "任务查询成功"
}
```

**成功响应示例（已完成）**:
```json
{
  "success": true,
  "data": {
    "id": "sora-2:task_01k7rtjcjjf08b031wzan1kb5r",
    "status": "completed",
    "created_at": 1760696021903,
    "model": "sora-2",
    "object": "video",
    "progress": 100,
    "seconds": "15",
    "size": "small",
    "url": "https://filesystem.site/cdn/20251017/78fd715fed4abc9b0bbdfe564e9d8b.mp4",
    "video_url": "https://filesystem.site/cdn/20251017/78fd715fed4abc9b0bbdfe564e9d8b.mp4"
  },
  "message": "任务查询成功"
}
```

**失败响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "sora-2:task_01k7rtn875f83t2f8ry0kb5ap1",
    "status": "failed",
    "created_at": 1760696116136,
    "model": "sora-2",
    "object": "video",
    "progress": 0,
    "seconds": "10",
    "size": "small",
    "error": {
      "code": "generation_failed",
      "message": "This content may violate our guardrails concerning similarity to third-party content."
    }
  },
  "message": "任务查询成功"
}
```

---

### 5. 查询视频生成任务（OpenAI 格式）

- **路径**: `GET /api/v1/ai/comfly/sora-2/videos/{taskId}`
- **描述**: 使用 OpenAI 格式路径查询已创建的视频生成任务状态和结果
- **路径参数**:
  - `taskId` (string, 必填): 任务 ID
- **Query 参数**:
  - `token_type` (string, 可选): Token 类型，默认根据 task_id 前缀自动判断
    - `"default"`: 使用廉价版 Token 查询
    - `"premium"`: 使用官方优质版 Token 查询
    - `"original"`: 使用 Original 版 Token 查询

**说明：**
- 此接口与第 3 个接口功能相同，只是调用的外部 API 路径不同
- 第 3 个接口调用：`/v2/videos/generations/{taskId}`
- 第 4 个接口调用：`/v1/videos/{taskId}`（OpenAI 格式）
- 返回格式完全相同

**成功响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "video_b9d05dda-0f9d-48c2-944e-7c5b47c6a399",
    "object": "video",
    "model": "sora-2-pro",
    "status": "queued",
    "progress": 0,
    "created_at": 1760679942,
    "seconds": "15",
    "size": "1280x720",
    "error": null,
    "video_url": ""
  },
  "message": "任务查询成功（OpenAI 格式）"
}
```

---

## fal.ai Sora 2 Text-to-Video API

### 6. 创建视频生成任务（fal.ai）

- **路径**: `POST /api/v1/ai/fal/sora-2/text-to-video`
- **描述**: 使用 fal.ai 的 Sora 2 模型从文本创建视频
- **认证**: 无（后端使用环境变量中的 `FAL_KEY`）
- **请求参数（JSON Body）**:
  - `prompt` (string, 必填): 文本描述词
  - `resolution` (string, 可选): 分辨率，默认 `"720p"`
  - `aspect_ratio` (string, 可选): 画面比例，默认 `"16:9"`，可选值：`"16:9"`, `"9:16"`
  - `duration` (string | number, 可选): 时长（秒），默认 `"4"`，可选值：`4`, `8`, `12`
  - `delete_video` (boolean, 可选): 是否在生成后删除视频，默认 `true`
  - `model` (string, 可选): 模型版本，默认 `"sora-2"`，可选值：
    - `"sora-2"`: 最新版本
    - `"sora-2-2025-12-08"`: 特定快照
    - `"sora-2-2025-10-06"`: 特定快照

**成功响应示例**:
```json
{
  "success": true,
  "data": {
    "request_id": "764cabcf-b745-4b3e-ae38-1200304cf45b",
    "status": "queued"
  },
  "message": "任务创建成功（fal.ai）"
}
```

### 7. 查询视频生成任务（fal.ai）

- **路径**: `GET /api/v1/ai/fal/sora-2/text-to-video/:requestId`
- **描述**: 查询 fal.ai 视频生成任务的状态和结果
- **路径参数**:
  - `requestId` (string, 必填): 任务请求 ID（创建任务时返回的 `request_id`）

**响应格式说明：**
- `status`: 任务状态
  - `queued`: 排队中
  - `in_progress`: 进行中
  - `completed`: 已完成
  - `failed`: 失败

**成功响应示例（排队中/进行中）**:
```json
{
  "success": true,
  "data": {
    "request_id": "764cabcf-b745-4b3e-ae38-1200304cf45b",
    "status": "in_progress",
    "logs": []
  },
  "message": "任务查询成功（fal.ai）"
}
```

**成功响应示例（已完成）**:
```json
{
  "success": true,
  "data": {
    "request_id": "764cabcf-b745-4b3e-ae38-1200304cf45b",
    "status": "completed",
    "video": {
      "url": "https://storage.googleapis.com/falserverless/example_outputs/sora_t2v_output.mp4",
      "content_type": "video/mp4",
      "file_name": "output.mp4",
      "file_size": 12345678
    },
    "video_id": "video_123",
    "thumbnail": {
      "url": "https://...",
      "content_type": "image/jpeg"
    }
  },
  "message": "任务查询成功（fal.ai）"
}
```

---

（更多接口待补充）
