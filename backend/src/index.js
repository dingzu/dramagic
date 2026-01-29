import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fal } from '@fal-ai/client';
import { getDbPool, initDb } from './db.js';
import pricing from './pricing.js';
import {
  initOssClient,
  isOssConfigured,
  uploadFromUrl,
  deleteFile,
  getSignedUrl,
  listFiles,
  getOssStatus
} from './oss.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// 数据库初始化（如配置了 DATABASE_URL）
let dbReady = false;
async function ensureDbReady() {
  if (dbReady) return true;
  try {
    await initDb();
    dbReady = true;
    console.log('✅ 数据库已就绪');
    return true;
  } catch (e) {
    console.warn('⚠️ 数据库未就绪（可忽略：仅影响项目管理功能）:', e.message);
    return false;
  }
}

// Comfly Chat 配置
const COMFLY_BASE_URL = process.env.COMFLY_BASE_URL || 'https://ai.comfly.chat';
const COMFLY_API_KEY = process.env.COMFLY_API_KEY; // 廉价版（逆向）
const COMFLY_API_KEY_PREMIUM = process.env.COMFLY_API_KEY_PREMIUM; // 官方优质版
const COMFLY_API_KEY_ORIGINAL = process.env.COMFLY_API_KEY_ORIGINAL; // Original 版

// fal.ai 配置
const FAL_KEY = process.env.FAL_KEY;
if (FAL_KEY) {
  fal.config({
    credentials: FAL_KEY
  });
}

// 阿里云 OSS 初始化
initOssClient();

// 创建 HTTP 服务器和 Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO 事件处理
// 追踪每个 socket 所在的项目房间，用于断开时更新人数
const socketProjectMap = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // 加入项目房间
  socket.on('join-project', ({ projectId }) => {
    if (!projectId) return;

    // 如果之前在其他房间，先离开
    const prevProjectId = socketProjectMap.get(socket.id);
    if (prevProjectId && prevProjectId !== projectId) {
      const prevRoom = `project-${prevProjectId}`;
      socket.leave(prevRoom);
      // 广播旧房间人数
      const prevCount = io.sockets.adapter.rooms.get(prevRoom)?.size || 0;
      io.to(prevRoom).emit('online-users', { count: prevCount });
    }

    const room = `project-${projectId}`;
    socket.join(room);
    socketProjectMap.set(socket.id, projectId);
    console.log(`Socket ${socket.id} joined room ${room}`);

    // 广播当前房间人数
    const count = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit('online-users', { count });
  });

  // 离开项目房间
  socket.on('leave-project', ({ projectId }) => {
    if (!projectId) return;
    const room = `project-${projectId}`;
    socket.leave(room);
    socketProjectMap.delete(socket.id);
    console.log(`Socket ${socket.id} left room ${room}`);

    // 广播当前房间人数
    const count = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit('online-users', { count });
  });

  // 画布更新广播
  socket.on('canvas-update', ({ projectId, state }) => {
    if (!projectId) return;
    const room = `project-${projectId}`;
    // 广播给房间内其他人（不包括发送者）
    socket.to(room).emit('canvas-update', { projectId, state });
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);

    // 获取之前所在的项目房间，广播更新后的人数
    const projectId = socketProjectMap.get(socket.id);
    if (projectId) {
      const room = `project-${projectId}`;
      socketProjectMap.delete(socket.id);
      // 延迟一点确保 socket 已从房间移除
      setTimeout(() => {
        const count = io.sockets.adapter.rooms.get(room)?.size || 0;
        io.to(room).emit('online-users', { count });
        console.log(`Room ${room} now has ${count} users`);
      }, 100);
    }
  });
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    },
    message: '服务运行正常'
  });
});

// 密码验证接口
app.post('/api/v1/auth/verify', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD || 'Dramagic2026';
  
  if (!password) {
    return res.status(400).json({
      success: false,
      error: '请输入密码'
    });
  }
  
  if (password === correctPassword) {
    return res.json({
      success: true,
      data: {
        authenticated: true
      },
      message: '密码验证成功'
    });
  } else {
    return res.status(401).json({
      success: false,
      error: '密码错误'
    });
  }
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Dramagic API',
      version: '1.0.0',
      description: 'Dramagic 后端服务'
    },
    message: '欢迎使用 Dramagic API'
  });
});

// API 路由示例
app.get('/api/v1/example', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '这是一个示例 API 接口'
    }
  });
});

/**
 * 价格配置 API
 * 
 * 1. 获取所有价格列表
 *    GET /api/v1/pricing
 * 
 * 2. 获取汇率
 *    GET /api/v1/pricing/exchange-rate
 * 
 * 3. 计算费用
 *    GET /api/v1/pricing/calculate?provider=fal&model=sora-2&duration=10
 */

// 获取所有价格列表
app.get(`/api/${API_VERSION}/pricing`, (req, res) => {
  const priceList = pricing.getAllPriceList();
  return res.json({
    success: true,
    data: {
      exchangeRate: pricing.EXCHANGE_RATES.USD_TO_CNY,
      prices: priceList
    },
    message: '获取价格列表成功'
  });
});

// 获取汇率
app.get(`/api/${API_VERSION}/pricing/exchange-rate`, (req, res) => {
  return res.json({
    success: true,
    data: {
      USD_TO_CNY: pricing.EXCHANGE_RATES.USD_TO_CNY
    },
    message: '获取汇率成功'
  });
});

// 计算费用
app.get(`/api/${API_VERSION}/pricing/calculate`, (req, res) => {
  const { provider, model, duration } = req.query;
  
  if (!provider || !model) {
    return res.status(400).json({
      success: false,
      error: 'provider 和 model 为必填参数',
      code: 'VALIDATION_ERROR'
    });
  }
  
  const durationNum = duration ? parseInt(duration) : 1;
  const cost = pricing.calculateCost(provider, model, durationNum);
  
  if (!cost) {
    return res.status(404).json({
      success: false,
      error: `未找到 ${provider}/${model} 的价格配置`,
      code: 'NOT_FOUND'
    });
  }
  
  return res.json({
    success: true,
    data: cost,
    message: '费用计算成功'
  });
});

/**
 * 项目管理（Project）
 * - GET    /api/v1/projects
 * - POST   /api/v1/projects
 * - GET    /api/v1/projects/:id
 * - PUT    /api/v1/projects/:id
 * - DELETE /api/v1/projects/:id
 */
app.get(`/api/${API_VERSION}/projects`, async (req, res) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用（请配置 DATABASE_URL）',
      code: 'DB_NOT_READY'
    });
  }

  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT id, name, created_at, updated_at
     FROM projects
     ORDER BY updated_at DESC`
  );

  return res.json({ success: true, data: rows });
});

app.post(`/api/${API_VERSION}/projects`, async (req, res) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用（请配置 DATABASE_URL）',
      code: 'DB_NOT_READY'
    });
  }

  const { name, canvas_state } = req.body || {};
  const projectName = (name || '').trim() || '未命名项目';

  const pool = getDbPool();
  const { rows } = await pool.query(
    `INSERT INTO projects (name, canvas_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     RETURNING id, name, created_at, updated_at`,
    [projectName, JSON.stringify(canvas_state || {})]
  );

  return res.status(201).json({ success: true, data: rows[0], message: '项目创建成功' });
});

app.get(`/api/${API_VERSION}/projects/:id`, async (req, res) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用（请配置 DATABASE_URL）',
      code: 'DB_NOT_READY'
    });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, error: 'id 不合法', code: 'VALIDATION_ERROR' });
  }

  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT id, name, canvas_state, created_at, updated_at
     FROM projects
     WHERE id = $1`,
    [id]
  );

  if (!rows[0]) {
    return res.status(404).json({ success: false, error: '项目不存在', code: 'NOT_FOUND' });
  }

  return res.json({ success: true, data: rows[0] });
});

app.put(`/api/${API_VERSION}/projects/:id`, async (req, res) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用（请配置 DATABASE_URL）',
      code: 'DB_NOT_READY'
    });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, error: 'id 不合法', code: 'VALIDATION_ERROR' });
  }

  const { name, canvas_state } = req.body || {};
  const updates = [];
  const params = [];
  let i = 1;

  if (typeof name === 'string') {
    updates.push(`name = $${i++}`);
    params.push(name.trim() || '未命名项目');
  }

  if (canvas_state !== undefined) {
    updates.push(`canvas_state = $${i++}::jsonb`);
    params.push(JSON.stringify(canvas_state || {}));
  }

  updates.push(`updated_at = NOW()`);

  if (params.length === 0) {
    // 仅更新时间
    params.push(id);
    const pool = getDbPool();
    const { rows } = await pool.query(
      `UPDATE projects SET updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, created_at, updated_at`,
      params
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: '项目不存在', code: 'NOT_FOUND' });
    }
    return res.json({ success: true, data: rows[0], message: '项目已更新' });
  }

  params.push(id);
  const pool = getDbPool();
  const { rows } = await pool.query(
    `UPDATE projects
     SET ${updates.join(', ')}
     WHERE id = $${i}
     RETURNING id, name, created_at, updated_at`,
    params
  );

  if (!rows[0]) {
    return res.status(404).json({ success: false, error: '项目不存在', code: 'NOT_FOUND' });
  }

  return res.json({ success: true, data: rows[0], message: '项目已更新' });
});

app.delete(`/api/${API_VERSION}/projects/:id`, async (req, res) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用（请配置 DATABASE_URL）',
      code: 'DB_NOT_READY'
    });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, error: 'id 不合法', code: 'VALIDATION_ERROR' });
  }

  const pool = getDbPool();
  const { rows } = await pool.query(
    `DELETE FROM projects WHERE id = $1 RETURNING id, name`,
    [id]
  );

  if (!rows[0]) {
    return res.status(404).json({ success: false, error: '项目不存在', code: 'NOT_FOUND' });
  }

  return res.json({ success: true, data: rows[0], message: '项目已删除' });
});

/**
 * Comfly Chat Sora-2 API（新版 /v1/videos 格式）
 *
 * 1. 创建视频生成任务
 *    POST /api/v1/ai/comfly/sora-2/videos
 *
 * 2. 查询任务状态
 *    GET /api/v1/ai/comfly/sora-2/videos/:taskId
 * 
 * 返回格式：
 * {
 *   "id": "video_xxx",
 *   "object": "video",
 *   "model": "sora-2",
 *   "status": "queued|in_progress|completed|failed",
 *   "progress": 0,
 *   "created_at": 1760679942,
 *   "seconds": "15",
 *   "size": "1280x720",
 *   "error": null,
 *   "video_url": ""
 * }
 */

// 创建视频生成任务（新版 /v1/videos）
app.post(`/api/${API_VERSION}/ai/comfly/sora-2/videos`, async (req, res, next) => {
  try {
    const {
      prompt,
      token_type = 'default', // 'default', 'premium', 'original'
      model = 'sora-2',
      size = '1280x720',
      seconds = '5',
      watermark = false
    } = req.body || {};

    // 根据 token_type 选择 API Key
    let apiKey;
    let tokenName;
    if (token_type === 'premium') {
      apiKey = COMFLY_API_KEY_PREMIUM;
      tokenName = '官方优质版';
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_PREMIUM（官方优质版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else if (token_type === 'original') {
      apiKey = COMFLY_API_KEY_ORIGINAL;
      tokenName = 'Original 版';
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_ORIGINAL（Original 版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else {
      apiKey = COMFLY_API_KEY;
      tokenName = '廉价版';
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY（廉价版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'prompt 为必填项',
        code: 'VALIDATION_ERROR'
      });
    }

    const url = `${COMFLY_BASE_URL}/v1/videos`;

    // 使用 FormData 格式
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('model', model);
    formData.append('prompt', prompt);
    formData.append('size', size);
    formData.append('seconds', String(seconds));
    formData.append('watermark', String(watermark));

    const response = await axios.post(url, formData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...formData.getHeaders()
      }
    });

    return res.json({
      success: true,
      data: response.data,
      message: `任务创建成功（使用${tokenName}）`
    });
  } catch (error) {
    console.error('创建 Comfly Sora-2 任务失败:', error.response?.data || error.message);

    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.error || error.response.data?.message || 'Comfly 接口调用失败',
        code: 'COMFLY_API_ERROR',
        details: error.response.data
      });
    }

    return next(error);
  }
});

// 查询任务状态（/v1/videos/:taskId）
app.get(`/api/${API_VERSION}/ai/comfly/sora-2/videos/:taskId`, async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { token_type } = req.query; // 支持通过 query 参数指定 token 类型

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'taskId 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    // 根据 token_type 选择 API Key
    let apiKey;
    if (token_type === 'premium') {
      apiKey = COMFLY_API_KEY_PREMIUM;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_PREMIUM（官方优质版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else if (token_type === 'original') {
      apiKey = COMFLY_API_KEY_ORIGINAL;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_ORIGINAL（Original 版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else {
      apiKey = COMFLY_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY（廉价版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    }

    const url = `${COMFLY_BASE_URL}/v1/videos/${encodeURIComponent(taskId)}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    return res.json({
      success: true,
      data: response.data,
      message: '任务查询成功'
    });
  } catch (error) {
    console.error('查询 Comfly Sora-2 任务失败:', error.response?.data || error.message);

    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.error || error.response.data?.message || 'Comfly 接口调用失败',
        code: 'COMFLY_API_ERROR',
        details: error.response.data
      });
    }

    return next(error);
  }
});

/**
 * fal.ai Sora 2 Text-to-Video API
 * 
 * 1. 创建视频生成任务
 *    POST /api/v1/ai/fal/sora-2/text-to-video
 * 
 * 2. 查询任务状态
 *    GET /api/v1/ai/fal/sora-2/text-to-video/:requestId
 */

// 创建视频生成任务（fal.ai Sora 2）
app.post(`/api/${API_VERSION}/ai/fal/sora-2/text-to-video`, async (req, res, next) => {
  try {
    if (!FAL_KEY) {
      return res.status(500).json({
        success: false,
        error: 'FAL_KEY 未配置',
        code: 'CONFIG_ERROR'
      });
    }

    const {
      prompt,
      resolution = '720p',
      aspect_ratio = '16:9',
      duration = '4',
      delete_video = true,
      model = 'sora-2'
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'prompt 为必填项',
        code: 'VALIDATION_ERROR'
      });
    }

    // 使用 fal.queue.submit 提交任务（异步）
    const { request_id } = await fal.queue.submit('fal-ai/sora-2/text-to-video', {
      input: {
        prompt,
        resolution,
        aspect_ratio,
        duration: parseInt(duration),
        delete_video,
        model
      }
    });

    return res.json({
      success: true,
      data: {
        request_id,
        status: 'queued'
      },
      message: '任务创建成功（fal.ai）'
    });
  } catch (error) {
    console.error('创建 fal.ai Sora-2 任务失败:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'fal.ai 接口调用失败',
      code: 'FAL_API_ERROR',
      details: error
    });
  }
});

// 查询任务状态（fal.ai Sora 2）
app.get(`/api/${API_VERSION}/ai/fal/sora-2/text-to-video/:requestId`, async (req, res, next) => {
  try {
    if (!FAL_KEY) {
      return res.status(500).json({
        success: false,
        error: 'FAL_KEY 未配置',
        code: 'CONFIG_ERROR'
      });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'requestId 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    // 查询任务状态
    const status = await fal.queue.status('fal-ai/sora-2/text-to-video', {
      requestId,
      logs: true
    });

    // 如果任务完成，获取结果
    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/sora-2/text-to-video', {
        requestId
      });

      return res.json({
        success: true,
        data: {
          request_id: requestId,
          status: 'completed',
          ...result.data
        },
        message: '任务查询成功（fal.ai）'
      });
    }

    // 返回任务状态
    return res.json({
      success: true,
      data: {
        request_id: requestId,
        status: status.status.toLowerCase(),
        logs: status.logs || []
      },
      message: '任务查询成功（fal.ai）'
    });
  } catch (error) {
    console.error('查询 fal.ai Sora-2 任务失败:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'fal.ai 接口调用失败',
      code: 'FAL_API_ERROR',
      details: error
    });
  }
});

/**
 * 阿里云 OSS 接口
 * 
 * 1. 获取 OSS 状态
 *    GET /api/v1/oss/status
 * 
 * 2. 上传视频（从 URL）
 *    POST /api/v1/oss/upload-from-url
 * 
 * 3. 删除文件
 *    DELETE /api/v1/oss/files/:ossPath
 * 
 * 4. 获取签名 URL
 *    GET /api/v1/oss/signed-url
 * 
 * 5. 列出文件
 *    GET /api/v1/oss/files
 */

// 获取 OSS 状态
app.get(`/api/${API_VERSION}/oss/status`, (req, res) => {
  const status = getOssStatus();
  return res.json({
    success: true,
    data: status,
    message: 'OSS 状态获取成功'
  });
});

// 从 URL 上传视频到 OSS
app.post(`/api/${API_VERSION}/oss/upload-from-url`, async (req, res, next) => {
  try {
    if (!isOssConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'OSS 未配置，请设置相关环境变量',
        code: 'OSS_NOT_CONFIGURED'
      });
    }

    const { url, folder = 'videos' } = req.body || {};

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    console.log(`📥 收到上传请求: ${url.substring(0, 100)}...`);

    const result = await uploadFromUrl(url, folder);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '上传失败',
        code: 'OSS_UPLOAD_ERROR'
      });
    }

    return res.json({
      success: true,
      data: {
        ossUrl: result.ossUrl,
        ossPath: result.ossPath,
        size: result.size,
        contentType: result.contentType
      },
      message: '视频上传 OSS 成功'
    });
  } catch (error) {
    console.error('上传视频到 OSS 失败:', error.message);
    return next(error);
  }
});

// 删除 OSS 文件
app.delete(`/api/${API_VERSION}/oss/files/:ossPath(*)`, async (req, res, next) => {
  try {
    if (!isOssConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'OSS 未配置',
        code: 'OSS_NOT_CONFIGURED'
      });
    }

    const { ossPath } = req.params;

    if (!ossPath) {
      return res.status(400).json({
        success: false,
        error: 'ossPath 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    const result = await deleteFile(ossPath);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '删除失败',
        code: 'OSS_DELETE_ERROR'
      });
    }

    return res.json({
      success: true,
      data: { ossPath },
      message: '文件删除成功'
    });
  } catch (error) {
    console.error('删除 OSS 文件失败:', error.message);
    return next(error);
  }
});

// 获取签名 URL（用于私有 Bucket）
app.get(`/api/${API_VERSION}/oss/signed-url`, async (req, res, next) => {
  try {
    if (!isOssConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'OSS 未配置',
        code: 'OSS_NOT_CONFIGURED'
      });
    }

    const { ossPath, expires = 3600 } = req.query;

    if (!ossPath) {
      return res.status(400).json({
        success: false,
        error: 'ossPath 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    const result = await getSignedUrl(ossPath, parseInt(expires));

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '生成签名 URL 失败',
        code: 'OSS_SIGNED_URL_ERROR'
      });
    }

    return res.json({
      success: true,
      data: {
        url: result.url,
        expiresIn: result.expiresIn
      },
      message: '签名 URL 生成成功'
    });
  } catch (error) {
    console.error('生成签名 URL 失败:', error.message);
    return next(error);
  }
});

// 列出 OSS 文件
app.get(`/api/${API_VERSION}/oss/files`, async (req, res, next) => {
  try {
    if (!isOssConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'OSS 未配置',
        code: 'OSS_NOT_CONFIGURED'
      });
    }

    const { prefix = 'videos/', maxKeys = 100 } = req.query;

    const result = await listFiles(prefix, parseInt(maxKeys));

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '列出文件失败',
        code: 'OSS_LIST_ERROR'
      });
    }

    return res.json({
      success: true,
      data: {
        files: result.files,
        count: result.files.length
      },
      message: '文件列表获取成功'
    });
  } catch (error) {
    console.error('列出 OSS 文件失败:', error.message);
    return next(error);
  }
});

/**
 * 视频任务管理 API
 * 
 * 1. 获取任务列表
 *    GET /api/v1/video-tasks
 * 
 * 2. 获取单个任务
 *    GET /api/v1/video-tasks/:id
 * 
 * 3. 创建任务记录
 *    POST /api/v1/video-tasks
 * 
 * 4. 更新任务（完成时上传 OSS）
 *    PUT /api/v1/video-tasks/:id
 * 
 * 5. 保存视频（组合接口：上传 OSS + 创建/更新任务记录）
 *    POST /api/v1/video-tasks/save-video
 */

// 获取任务列表
app.get(`/api/${API_VERSION}/video-tasks`, async (req, res, next) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用',
      code: 'DB_NOT_READY'
    });
  }

  try {
    const { user_id = 'admin', project_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, user_id, project_id, prompt, duration, source, 
             source_task_id, source_video_url, oss_url, oss_path, 
             status, error, cost_usd, cost_cny, created_at, completed_at
      FROM video_tasks
      WHERE user_id = $1
    `;
    const params = [user_id];
    let paramIdx = 2;

    if (project_id) {
      query += ` AND project_id = $${paramIdx++}`;
      params.push(project_id);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const pool = getDbPool();
    const { rows } = await pool.query(query, params);

    // 获取总数
    let countQuery = `SELECT COUNT(*) as total FROM video_tasks WHERE user_id = $1`;
    const countParams = [user_id];
    if (project_id) {
      countQuery += ` AND project_id = $2`;
      countParams.push(project_id);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || 0);

    return res.json({
      success: true,
      data: {
        tasks: rows,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      },
      message: '任务列表获取成功'
    });
  } catch (error) {
    console.error('获取任务列表失败:', error.message);
    return next(error);
  }
});

// 获取单个任务
app.get(`/api/${API_VERSION}/video-tasks/:id`, async (req, res, next) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用',
      code: 'DB_NOT_READY'
    });
  }

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        error: 'id 不合法',
        code: 'VALIDATION_ERROR'
      });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM video_tasks WHERE id = $1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        code: 'NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: rows[0],
      message: '任务获取成功'
    });
  } catch (error) {
    console.error('获取任务失败:', error.message);
    return next(error);
  }
});

// 创建任务记录
app.post(`/api/${API_VERSION}/video-tasks`, async (req, res, next) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用',
      code: 'DB_NOT_READY'
    });
  }

  try {
    const {
      user_id = 'admin',
      project_id,
      prompt,
      duration = 4,
      source,
      source_task_id,
      cost_usd,
      cost_cny,
      status = 'pending'
    } = req.body || {};

    if (!prompt || !source) {
      return res.status(400).json({
        success: false,
        error: 'prompt 和 source 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO video_tasks 
       (user_id, project_id, prompt, duration, source, source_task_id, cost_usd, cost_cny, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user_id, project_id || null, prompt, duration, source, source_task_id || null, cost_usd || null, cost_cny || null, status]
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: '任务创建成功'
    });
  } catch (error) {
    console.error('创建任务失败:', error.message);
    return next(error);
  }
});

// 更新任务
app.put(`/api/${API_VERSION}/video-tasks/:id`, async (req, res, next) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用',
      code: 'DB_NOT_READY'
    });
  }

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        error: 'id 不合法',
        code: 'VALIDATION_ERROR'
      });
    }

    const {
      source_video_url,
      oss_url,
      oss_path,
      status,
      error: taskError
    } = req.body || {};

    const updates = [];
    const params = [];
    let i = 1;

    if (source_video_url !== undefined) {
      updates.push(`source_video_url = $${i++}`);
      params.push(source_video_url);
    }
    if (oss_url !== undefined) {
      updates.push(`oss_url = $${i++}`);
      params.push(oss_url);
    }
    if (oss_path !== undefined) {
      updates.push(`oss_path = $${i++}`);
      params.push(oss_path);
    }
    if (status !== undefined) {
      updates.push(`status = $${i++}`);
      params.push(status);
      if (status === 'completed') {
        updates.push(`completed_at = NOW()`);
      }
    }
    if (taskError !== undefined) {
      updates.push(`error = $${i++}`);
      params.push(taskError);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有需要更新的字段',
        code: 'VALIDATION_ERROR'
      });
    }

    params.push(id);
    const pool = getDbPool();
    const { rows } = await pool.query(
      `UPDATE video_tasks SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        code: 'NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: rows[0],
      message: '任务更新成功'
    });
  } catch (error) {
    console.error('更新任务失败:', error.message);
    return next(error);
  }
});

// 保存视频（组合接口：上传 OSS + 创建任务记录）
app.post(`/api/${API_VERSION}/video-tasks/save-video`, async (req, res, next) => {
  const ok = await ensureDbReady();
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: '数据库未配置或不可用',
      code: 'DB_NOT_READY'
    });
  }

  try {
    const {
      user_id = 'admin',
      project_id,
      prompt,
      duration = 4,
      source,
      source_task_id,
      source_video_url,
      cost_usd,
      cost_cny
    } = req.body || {};

    if (!prompt || !source || !source_video_url) {
      return res.status(400).json({
        success: false,
        error: 'prompt, source, source_video_url 为必填参数',
        code: 'VALIDATION_ERROR'
      });
    }

    let ossUrl = null;
    let ossPath = null;
    let ossError = null;

    // 尝试上传到 OSS
    if (isOssConfigured()) {
      console.log(`📥 开始保存视频到 OSS: ${source_video_url.substring(0, 80)}...`);
      const ossResult = await uploadFromUrl(source_video_url, 'videos');
      
      if (ossResult.success) {
        ossUrl = ossResult.ossUrl;
        ossPath = ossResult.ossPath;
        console.log(`✅ 视频已保存到 OSS: ${ossUrl}`);
      } else {
        ossError = ossResult.error;
        console.warn(`⚠️ OSS 上传失败（将仅保存源 URL）: ${ossError}`);
      }
    } else {
      console.log('⚠️ OSS 未配置，仅保存任务记录（不上传）');
    }

    // 创建任务记录
    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO video_tasks 
       (user_id, project_id, prompt, duration, source, source_task_id, source_video_url, oss_url, oss_path, cost_usd, cost_cny, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed', NOW())
       RETURNING *`,
      [
        user_id,
        project_id || null,
        prompt,
        duration,
        source,
        source_task_id || null,
        source_video_url,
        ossUrl,
        ossPath,
        cost_usd || null,
        cost_cny || null
      ]
    );

    return res.status(201).json({
      success: true,
      data: {
        task: rows[0],
        ossUploaded: !!ossUrl,
        ossError: ossError
      },
      message: ossUrl ? '视频已保存到 OSS' : '任务已记录（OSS 未上传）'
    });
  } catch (error) {
    console.error('保存视频失败:', error.message);
    return next(error);
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    code: 'NOT_FOUND'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器（使用 httpServer 以支持 Socket.IO）
httpServer.listen(PORT, () => {
  console.log(`🚀 Dramagic 后端服务已启动`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Socket.IO 已启用`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
});
