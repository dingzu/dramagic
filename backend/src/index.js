import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { fal } from '@fal-ai/client';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

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

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
 * ai.comfly.chat.sora-2
 *
 * 1. 创建视频生成任务
 *    POST /api/v1/ai/comfly/sora-2/generations
 *
 * 2. 查询任务状态
 *    GET /api/v1/ai/comfly/sora-2/generations/:taskId
 */

// 创建视频生成任务
app.post(`/api/${API_VERSION}/ai/comfly/sora-2/generations`, async (req, res, next) => {
  try {
    const {
      prompt,
      token_type = 'default', // 'default' 或 'premium'
      // 廉价版参数
      aspect_ratio,
      hd,
      // 官方版参数
      size,
      // 通用参数
      duration
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

    const url = `${COMFLY_BASE_URL}/v2/videos/generations`;

    // 根据 token_type 构建不同的请求体
    const requestBody = {
      prompt,
      model: 'sora-2',
      duration: duration || (token_type === 'premium' || token_type === 'original' ? '5' : '10')
    };

    // 官方版和 Original 版使用 size 参数
    if (token_type === 'premium' || token_type === 'original') {
      requestBody.size = size || '1280x720';
    } else {
      // 廉价版使用 aspect_ratio 和 hd 参数
      requestBody.aspect_ratio = aspect_ratio || '16:9';
      requestBody.hd = hd || false;
    }

    const response = await axios.post(
      url,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

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
        error: error.response.data?.error || 'Comfly 接口调用失败',
        code: 'COMFLY_API_ERROR',
        details: error.response.data
      });
    }

    return next(error);
  }
});

// 查询任务状态
app.get(`/api/${API_VERSION}/ai/comfly/sora-2/generations/:taskId`, async (req, res, next) => {
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

    // 根据 token_type 或 taskId 前缀判断使用哪个 API Key
    let apiKey;
    if (token_type === 'premium' || taskId.includes('video_')) {
      // 官方版任务 ID 通常以 video_ 开头
      apiKey = COMFLY_API_KEY_PREMIUM;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_PREMIUM（官方优质版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else if (token_type === 'original') {
      // Original 版
      apiKey = COMFLY_API_KEY_ORIGINAL;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_ORIGINAL（Original 版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else {
      // 廉价版
      apiKey = COMFLY_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY（廉价版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    }

    const url = `${COMFLY_BASE_URL}/v2/videos/generations/${encodeURIComponent(taskId)}`;

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
        error: error.response.data?.error || 'Comfly 接口调用失败',
        code: 'COMFLY_API_ERROR',
        details: error.response.data
      });
    }

    return next(error);
  }
});

// 查询任务状态（OpenAI 格式 /v1/videos/{task_id}）
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

    // 根据 token_type 或 taskId 前缀判断使用哪个 API Key
    let apiKey;
    if (token_type === 'premium' || taskId.includes('video_')) {
      // 官方版任务 ID 通常以 video_ 开头
      apiKey = COMFLY_API_KEY_PREMIUM;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_PREMIUM（官方优质版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else if (token_type === 'original') {
      // Original 版
      apiKey = COMFLY_API_KEY_ORIGINAL;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'COMFLY_API_KEY_ORIGINAL（Original 版）未配置',
          code: 'CONFIG_ERROR'
        });
      }
    } else {
      // 廉价版
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
      message: '任务查询成功（OpenAI 格式）'
    });
  } catch (error) {
    console.error('查询 Comfly Sora-2 任务失败（OpenAI 格式）:', error.response?.data || error.message);

    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.error || 'Comfly 接口调用失败',
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Dramagic 后端服务已启动`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
});
