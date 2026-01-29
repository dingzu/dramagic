/**
 * 阿里云 OSS 服务模块
 * 用于视频文件的上传和管理
 */

import OSS from 'ali-oss';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// OSS 客户端实例
let ossClient = null;

/**
 * 获取 OSS 配置
 */
function getOssConfig() {
  return {
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    // 自定义域名（可选）
    customDomain: process.env.OSS_CUSTOM_DOMAIN || null
  };
}

/**
 * 检查 OSS 是否已配置
 */
export function isOssConfigured() {
  const config = getOssConfig();
  return !!(config.region && config.accessKeyId && config.accessKeySecret && config.bucket);
}

/**
 * 初始化 OSS 客户端
 */
export function initOssClient() {
  if (ossClient) return ossClient;

  const config = getOssConfig();
  
  if (!isOssConfigured()) {
    console.warn('⚠️ OSS 未配置（请设置 OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET）');
    return null;
  }

  try {
    ossClient = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      secure: true // 使用 HTTPS
    });
    
    console.log('✅ OSS 客户端初始化成功');
    console.log(`   Bucket: ${config.bucket}`);
    console.log(`   Region: ${config.region}`);
    return ossClient;
  } catch (error) {
    console.error('❌ OSS 客户端初始化失败:', error.message);
    return null;
  }
}

/**
 * 获取 OSS 客户端
 */
export function getOssClient() {
  if (!ossClient) {
    return initOssClient();
  }
  return ossClient;
}

/**
 * 生成 OSS 文件路径
 * 格式：videos/YYYY/MM/DD/{uuid}.{ext}
 */
function generateOssPath(filename, folder = 'videos') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const ext = path.extname(filename) || '.mp4';
  const uniqueId = uuidv4();
  
  return `${folder}/${year}/${month}/${day}/${uniqueId}${ext}`;
}

/**
 * 从 URL 下载文件并上传到 OSS
 * @param {string} sourceUrl - 源视频 URL
 * @param {string} folder - OSS 文件夹（默认 videos）
 * @param {object} options - 额外选项
 * @returns {Promise<{success: boolean, ossUrl?: string, ossPath?: string, error?: string}>}
 */
export async function uploadFromUrl(sourceUrl, folder = 'videos', options = {}) {
  const client = getOssClient();
  
  if (!client) {
    return {
      success: false,
      error: 'OSS 未配置或初始化失败'
    };
  }

  try {
    console.log(`📥 开始从 URL 下载视频: ${sourceUrl.substring(0, 100)}...`);
    
    // 下载视频到内存
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 分钟超时
      maxContentLength: 500 * 1024 * 1024, // 最大 500MB
      headers: {
        'User-Agent': 'Dramagic/1.0'
      }
    });

    const contentType = response.headers['content-type'] || 'video/mp4';
    const buffer = Buffer.from(response.data);
    
    console.log(`📦 视频下载完成，大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 确定文件扩展名
    let ext = '.mp4';
    if (contentType.includes('webm')) ext = '.webm';
    else if (contentType.includes('mov')) ext = '.mov';
    else if (contentType.includes('avi')) ext = '.avi';
    
    // 生成 OSS 路径
    const ossPath = generateOssPath(`video${ext}`, folder);
    
    console.log(`📤 开始上传到 OSS: ${ossPath}`);
    
    // 上传到 OSS
    const result = await client.put(ossPath, buffer, {
      mime: contentType,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=31536000', // 缓存 1 年
        ...(options.headers || {})
      }
    });

    // 构建访问 URL
    const config = getOssConfig();
    let ossUrl;
    
    if (config.customDomain) {
      // 使用自定义域名
      ossUrl = `https://${config.customDomain}/${ossPath}`;
    } else {
      // 使用默认 OSS 域名
      ossUrl = result.url;
    }

    console.log(`✅ 视频上传 OSS 成功: ${ossUrl}`);

    return {
      success: true,
      ossUrl,
      ossPath,
      size: buffer.length,
      contentType
    };
  } catch (error) {
    console.error('❌ 上传视频到 OSS 失败:', error.message);
    
    return {
      success: false,
      error: error.message || '上传失败'
    };
  }
}

/**
 * 直接上传 Buffer 到 OSS
 * @param {Buffer} buffer - 文件内容
 * @param {string} filename - 文件名
 * @param {string} folder - OSS 文件夹
 * @param {object} options - 额外选项
 */
export async function uploadBuffer(buffer, filename, folder = 'videos', options = {}) {
  const client = getOssClient();
  
  if (!client) {
    return {
      success: false,
      error: 'OSS 未配置或初始化失败'
    };
  }

  try {
    const ossPath = generateOssPath(filename, folder);
    const contentType = options.contentType || 'video/mp4';
    
    const result = await client.put(ossPath, buffer, {
      mime: contentType,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=31536000',
        ...(options.headers || {})
      }
    });

    const config = getOssConfig();
    let ossUrl;
    
    if (config.customDomain) {
      ossUrl = `https://${config.customDomain}/${ossPath}`;
    } else {
      ossUrl = result.url;
    }

    return {
      success: true,
      ossUrl,
      ossPath,
      size: buffer.length
    };
  } catch (error) {
    console.error('❌ 上传 Buffer 到 OSS 失败:', error.message);
    
    return {
      success: false,
      error: error.message || '上传失败'
    };
  }
}

/**
 * 删除 OSS 文件
 * @param {string} ossPath - OSS 文件路径
 */
export async function deleteFile(ossPath) {
  const client = getOssClient();
  
  if (!client) {
    return {
      success: false,
      error: 'OSS 未配置或初始化失败'
    };
  }

  try {
    await client.delete(ossPath);
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ 删除 OSS 文件失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成签名 URL（用于私有 Bucket）
 * @param {string} ossPath - OSS 文件路径
 * @param {number} expires - 过期时间（秒），默认 3600（1小时）
 */
export function getSignedUrl(ossPath, expires = 3600) {
  const client = getOssClient();
  
  if (!client) {
    return {
      success: false,
      error: 'OSS 未配置或初始化失败'
    };
  }

  try {
    // 使用 signatureUrl 生成带签名的临时访问 URL
    // 注意：不要设置 response.content-type，OSS 不允许覆盖
    const url = client.signatureUrl(ossPath, {
      expires
    });
    
    return {
      success: true,
      url,
      expiresIn: expires
    };
  } catch (error) {
    console.error('❌ 生成签名 URL 失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 快速获取签名 URL（简化版，直接返回 URL 字符串）
 * @param {string} ossPath - OSS 文件路径
 * @param {number} expires - 过期时间（秒），默认 3600
 * @returns {string|null} 签名 URL 或 null
 */
export function getSignedUrlString(ossPath, expires = 3600) {
  if (!ossPath) return null;
  const result = getSignedUrl(ossPath, expires);
  return result.success ? result.url : null;
}

/**
 * 列出指定目录下的文件
 * @param {string} prefix - 目录前缀
 * @param {number} maxKeys - 最大返回数量
 */
export async function listFiles(prefix = 'videos/', maxKeys = 100) {
  const client = getOssClient();
  
  if (!client) {
    return {
      success: false,
      error: 'OSS 未配置或初始化失败'
    };
  }

  try {
    const result = await client.list({
      prefix,
      'max-keys': maxKeys
    });

    return {
      success: true,
      files: (result.objects || []).map(obj => ({
        name: obj.name,
        size: obj.size,
        lastModified: obj.lastModified,
        url: obj.url
      }))
    };
  } catch (error) {
    console.error('❌ 列出 OSS 文件失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取 OSS 状态信息
 */
export function getOssStatus() {
  const config = getOssConfig();
  
  return {
    configured: isOssConfigured(),
    region: config.region || null,
    bucket: config.bucket || null,
    hasCustomDomain: !!config.customDomain,
    customDomain: config.customDomain || null
  };
}

export default {
  initOssClient,
  getOssClient,
  isOssConfigured,
  uploadFromUrl,
  uploadBuffer,
  deleteFile,
  getSignedUrl,
  getSignedUrlString,
  listFiles,
  getOssStatus
};
