/**
 * Dramagic 价格配置文件
 * 
 * 该文件集中管理所有 MaaS 服务的价格配置
 * 前端和后端都可以引用此配置
 */

// =====================
// 汇率配置
// =====================
export const EXCHANGE_RATES = {
  USD_TO_CNY: 7.25, // 美元兑人民币汇率（可根据实际情况调整）
};

// =====================
// 辅助函数
// =====================

/**
 * 将美元转换为人民币
 * @param {number} usd - 美元金额
 * @returns {number} - 人民币金额
 */
export function usdToCny(usd) {
  return usd * EXCHANGE_RATES.USD_TO_CNY;
}

/**
 * 将人民币转换为美元
 * @param {number} cny - 人民币金额
 * @returns {number} - 美元金额
 */
export function cnyToUsd(cny) {
  return cny / EXCHANGE_RATES.USD_TO_CNY;
}

/**
 * 格式化价格显示
 * @param {number} price - 价格
 * @param {string} currency - 货币类型 'USD' 或 'CNY'
 * @param {number} decimals - 小数位数
 * @returns {string} - 格式化后的价格字符串
 */
export function formatPrice(price, currency = 'CNY', decimals = 4) {
  const symbol = currency === 'USD' ? '$' : '¥';
  return `${symbol}${price.toFixed(decimals)}`;
}

// =====================
// MaaS 服务价格配置
// =====================

/**
 * Toapis 价格配置
 * @see https://toapis.com/
 */
export const TOAPIS_PRICING = {
  provider: 'toapis',
  name: 'Toapis',
  models: {
    'sora': {
      name: 'Sora',
      priceUSD: 0.0250,
      unit: 'per_request', // 每次
      get priceCNY() { return usdToCny(this.priceUSD); }
    },
    'sora-2-pro': {
      name: 'Sora 2 Pro',
      priceUSD: 0.6000,
      unit: 'per_request', // 每次
      get priceCNY() { return usdToCny(this.priceUSD); }
    }
  }
};

/**
 * Comfly Chat 价格配置
 * @see https://ai.comfly.chat/token
 */
export const COMFLY_PRICING = {
  provider: 'comfly',
  name: 'Comfly Chat',
  models: {
    'default': {
      name: '廉价版（逆向）',
      priceCNY: 0.12,
      unit: 'per_request', // 每次
      get priceUSD() { return cnyToUsd(this.priceCNY); }
    },
    'premium': {
      name: 'OpenAI 官方',
      priceCNY: 0.48,
      unit: 'per_second', // 每秒
      get priceUSD() { return cnyToUsd(this.priceCNY); }
    },
    'original': {
      name: 'Original 版',
      priceCNY: 0.876,
      unit: 'per_second', // 每秒
      get priceUSD() { return cnyToUsd(this.priceCNY); }
    },
    'pro': {
      name: 'Pro 版',
      priceCNY: 2.5,
      unit: 'per_request', // 每次
      get priceUSD() { return cnyToUsd(this.priceCNY); }
    }
  }
};

/**
 * Fal AI 价格配置
 * @see https://fal.ai/models/fal-ai/sora-2/text-to-video/api
 */
export const FAL_PRICING = {
  provider: 'fal',
  name: 'Fal AI',
  models: {
    'sora-2': {
      name: 'Sora 2',
      priceUSD: 0.1,
      unit: 'per_second', // 每秒
      resolution: '720p',
      supportedDurations: [4, 8, 12], // 支持的视频时长（秒）
      get priceCNY() { return usdToCny(this.priceUSD); }
    }
  }
};

// =====================
// 统一价格获取接口
// =====================

/**
 * 所有 MaaS 服务价格配置
 */
export const ALL_PRICING = {
  toapis: TOAPIS_PRICING,
  comfly: COMFLY_PRICING,
  fal: FAL_PRICING
};

/**
 * 获取指定服务和模型的价格信息
 * @param {string} provider - 服务提供商 (toapis, comfly, fal)
 * @param {string} model - 模型名称
 * @returns {object|null} - 价格信息对象
 */
export function getPrice(provider, model) {
  const pricing = ALL_PRICING[provider];
  if (!pricing || !pricing.models[model]) {
    return null;
  }
  return pricing.models[model];
}

/**
 * 计算视频生成费用
 * @param {string} provider - 服务提供商
 * @param {string} model - 模型名称
 * @param {number} duration - 视频时长（秒），仅对 per_second 计费有效
 * @returns {object} - { priceUSD, priceCNY, unit }
 */
export function calculateCost(provider, model, duration = 1) {
  const priceInfo = getPrice(provider, model);
  if (!priceInfo) {
    return null;
  }
  
  let totalUSD, totalCNY;
  
  if (priceInfo.unit === 'per_second') {
    totalUSD = priceInfo.priceUSD * duration;
    totalCNY = priceInfo.priceCNY * duration;
  } else {
    // per_request
    totalUSD = priceInfo.priceUSD;
    totalCNY = priceInfo.priceCNY;
  }
  
  return {
    priceUSD: totalUSD,
    priceCNY: totalCNY,
    unit: priceInfo.unit,
    duration: priceInfo.unit === 'per_second' ? duration : null,
    formatted: {
      USD: formatPrice(totalUSD, 'USD'),
      CNY: formatPrice(totalCNY, 'CNY')
    }
  };
}

/**
 * 获取所有价格列表（用于前端展示）
 * @returns {Array} - 价格列表
 */
export function getAllPriceList() {
  const list = [];
  
  for (const [providerKey, provider] of Object.entries(ALL_PRICING)) {
    for (const [modelKey, model] of Object.entries(provider.models)) {
      list.push({
        provider: providerKey,
        providerName: provider.name,
        model: modelKey,
        modelName: model.name,
        priceUSD: model.priceUSD,
        priceCNY: model.priceCNY,
        unit: model.unit,
        unitLabel: model.unit === 'per_second' ? '每秒' : '每次',
        formattedUSD: formatPrice(model.priceUSD, 'USD'),
        formattedCNY: formatPrice(model.priceCNY, 'CNY')
      });
    }
  }
  
  return list;
}

// =====================
// 默认导出
// =====================
export default {
  EXCHANGE_RATES,
  usdToCny,
  cnyToUsd,
  formatPrice,
  TOAPIS_PRICING,
  COMFLY_PRICING,
  FAL_PRICING,
  ALL_PRICING,
  getPrice,
  calculateCost,
  getAllPriceList
};
