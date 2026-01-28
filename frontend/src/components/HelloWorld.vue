<script setup>
import { ref, computed } from 'vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Comfly Chat 参数
// 官方优质版参数
const premiumPrompt = ref('')
const premiumSize = ref('1280x720')
const premiumDuration = ref('5')

// Original 版参数
const originalPrompt = ref('')
const originalSize = ref('1280x720')
const originalDuration = ref('5')

// 廉价版参数
const cheapPrompt = ref('')
const cheapAspectRatio = ref('16:9')
const cheapHd = ref(false)
const cheapDuration = ref('10')

// fal.ai 参数
const falPrompt = ref('')
const falResolution = ref('720p')
const falAspectRatio = ref('16:9')
const falDuration = ref('4')
const falModel = ref('sora-2')

const creating = ref(false)
const creatingFal = ref(false)
const querying = ref(false)
const queryingFal = ref(false)
const activeTab = ref('cheap') // 'cheap', 'premium', 或 'original'

// Comfly Chat 查询参数
const lastTaskId = ref('')
const lastTokenType = ref('default') // 记录上次创建任务使用的 token 类型
const queryTaskId = ref('')
const queryTokenType = ref('default') // 查询时使用的 token 类型
const queryApiFormat = ref('v2') // 'v2' 或 'v1' (OpenAI 格式)

const createResult = ref(null)
const queryResult = ref(null)

// fal.ai 查询参数
const falRequestId = ref('')
const falQueryRequestId = ref('')

const falCreateResult = ref(null)
const falQueryResult = ref(null)

const errorMessage = ref('')

const hasTaskId = computed(() => !!lastTaskId.value)

const resetError = () => {
  errorMessage.value = ''
}

const handleCreate = async () => {
  resetError()

  const currentTab = activeTab.value
  let currentPrompt
  let requestBody

  if (currentTab === 'premium') {
    currentPrompt = premiumPrompt.value
    requestBody = {
      prompt: premiumPrompt.value,
      size: premiumSize.value,
      duration: premiumDuration.value,
      token_type: 'premium',
    }
  } else if (currentTab === 'original') {
    currentPrompt = originalPrompt.value
    requestBody = {
      prompt: originalPrompt.value,
      size: originalSize.value,
      duration: originalDuration.value,
      token_type: 'original',
    }
  } else {
    currentPrompt = cheapPrompt.value
    requestBody = {
      prompt: cheapPrompt.value,
      aspect_ratio: cheapAspectRatio.value,
      hd: cheapHd.value,
      duration: cheapDuration.value,
      token_type: 'default',
    }
  }

  if (!currentPrompt.trim()) {
    errorMessage.value = '请输入描述词（prompt）'
    return
  }

  creating.value = true
  createResult.value = null

  try {

    const resp = await fetch(
      `${apiBaseUrl}/api/v1/ai/comfly/sora-2/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    )

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '创建任务失败')
    }

    createResult.value = data.data
    // 兼容不同返回格式：task_id 或 id
    lastTaskId.value = data.data?.task_id || data.data?.id || ''
    lastTokenType.value = currentTab === 'premium' ? 'premium' : currentTab === 'original' ? 'original' : 'default'
    if (lastTaskId.value) {
      queryTaskId.value = lastTaskId.value
      // 自动设置查询区域的 token 类型为本次创建使用的类型
      queryTokenType.value = lastTokenType.value
    }
  } catch (err) {
    errorMessage.value = err.message || '创建任务时发生错误'
  } finally {
    creating.value = false
  }
}

// fal.ai 创建任务
const handleCreateFal = async () => {
  resetError()

  if (!falPrompt.value.trim()) {
    errorMessage.value = '请输入描述词（prompt）'
    return
  }

  creatingFal.value = true
  falCreateResult.value = null

  try {
    const resp = await fetch(
      `${apiBaseUrl}/api/v1/ai/fal/sora-2/text-to-video`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: falPrompt.value,
          resolution: falResolution.value,
          aspect_ratio: falAspectRatio.value,
          duration: parseInt(falDuration.value),
          model: falModel.value,
        }),
      },
    )

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '创建任务失败')
    }

    falCreateResult.value = data.data
    falRequestId.value = data.data?.request_id || ''
    if (falRequestId.value) {
      falQueryRequestId.value = falRequestId.value
    }
  } catch (err) {
    errorMessage.value = err.message || '创建任务时发生错误'
  } finally {
    creatingFal.value = false
  }
}

// fal.ai 查询任务
const handleQueryFal = async () => {
  resetError()

  const id = falQueryRequestId.value.trim()
  if (!id) {
    errorMessage.value = '请输入要查询的 request_id'
    return
  }

  queryingFal.value = true
  falQueryResult.value = null

  try {
    const resp = await fetch(
      `${apiBaseUrl}/api/v1/ai/fal/sora-2/text-to-video/${encodeURIComponent(
        id,
      )}`,
      {
        method: 'GET',
      },
    )

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '查询任务失败')
    }

    falQueryResult.value = data.data
  } catch (err) {
    errorMessage.value = err.message || '查询任务时发生错误'
  } finally {
    queryingFal.value = false
  }
}

const handleQuery = async () => {
  resetError()

  const id = queryTaskId.value.trim()
  if (!id) {
    errorMessage.value = '请输入要查询的 task_id'
    return
  }

  querying.value = true
  queryResult.value = null

  try {
    // 使用用户选择的 token 类型
    const tokenType = queryTokenType.value
    
    // 根据选择的 API 格式构建不同的路径
    const apiPath =
      queryApiFormat.value === 'v1'
        ? `/api/v1/ai/comfly/sora-2/videos/${encodeURIComponent(id)}`
        : `/api/v1/ai/comfly/sora-2/generations/${encodeURIComponent(id)}`
    
    const resp = await fetch(
      `${apiBaseUrl}${apiPath}?token_type=${tokenType}`,
      {
        method: 'GET',
      },
    )

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '查询任务失败')
    }

    queryResult.value = data.data
  } catch (err) {
    errorMessage.value = err.message || '查询任务时发生错误'
  } finally {
    querying.value = false
  }
}
</script>

<template>
  <main class="page">
    <h1 class="main-title">Sora 视频生成平台</h1>
    <p class="main-subtitle">
      接入多个 Sora API 服务，支持不同价格和配置选项
    </p>

    <div v-if="errorMessage" class="alert alert-error">
      {{ errorMessage }}
    </div>

    <div class="container">

      <!-- 左侧：Comfly Chat -->
      <section class="section left-section">
        <div class="section-header">
          <h2 class="section-title">Comfly Chat (ai.comfly.chat)</h2>
          <span class="section-badge">3 个 Token 选项</span>
        </div>

      <div class="card">
        <h3 class="card-title">创建任务</h3>

        <!-- Tab 切换 -->
        <div class="tabs">
          <button
            class="tab"
            :class="{ active: activeTab === 'cheap' }"
            @click="activeTab = 'cheap'"
          >
            廉价版（逆向）¥0.12/次
          </button>
          <button
            class="tab"
            :class="{ active: activeTab === 'premium' }"
            @click="activeTab = 'premium'"
          >
            官方优质版 ¥0.48/秒
          </button>
          <button
            class="tab"
            :class="{ active: activeTab === 'original' }"
            @click="activeTab = 'original'"
          >
            Original 版 ¥0.876/秒
          </button>
        </div>

        <!-- 廉价版表单 -->
        <div v-if="activeTab === 'cheap'" class="tab-content">
          <label class="field">
            <span class="field-label">描述词（prompt）</span>
            <textarea
              v-model="cheapPrompt"
              class="textarea"
              rows="4"
              placeholder="例如：一只小猫在草地上奔跑，电影感镜头，阳光、慢动作"
            ></textarea>
          </label>

          <div class="field-row">
            <label class="field">
              <span class="field-label">画面比例（aspect_ratio）</span>
              <select v-model="cheapAspectRatio" class="select">
                <option value="16:9">16:9（横屏）</option>
                <option value="9:16">9:16（竖屏）</option>
                <option value="1:1">1:1（方形）</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">时长（秒）</span>
              <select v-model="cheapDuration" class="select">
                <option value="10">10 秒</option>
                <option value="15">15 秒</option>
              </select>
            </label>
          </div>

          <label class="checkbox">
            <input v-model="cheapHd" type="checkbox" />
            <span>启用高清（hd）</span>
          </label>

          <div class="info-box">
            <strong>💡 廉价版说明：</strong>仅支持 10 秒或 15 秒时长
          </div>
        </div>

        <!-- 官方优质版表单 -->
        <div v-if="activeTab === 'premium'" class="tab-content">
          <label class="field">
            <span class="field-label">描述词（prompt）</span>
            <textarea
              v-model="premiumPrompt"
              class="textarea"
              rows="4"
              placeholder="例如：一只小猫在草地上奔跑，电影感镜头，阳光、慢动作"
            ></textarea>
          </label>

          <div class="field-row">
            <label class="field">
              <span class="field-label">分辨率（size）</span>
              <select v-model="premiumSize" class="select">
                <option value="1280x720">1280x720（720P 横屏）</option>
                <option value="720x1280">720x1280（720P 竖屏）</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">时长（秒）</span>
              <input
                v-model="premiumDuration"
                class="input"
                type="number"
                min="4"
                max="60"
                step="1"
              />
            </label>
          </div>

          <div class="info-box">
            <strong>💡 官方版说明：</strong>支持 4 秒以上，按秒计费（¥0.48/秒）
          </div>
        </div>

        <!-- Original 版表单 -->
        <div v-if="activeTab === 'original'" class="tab-content">
          <label class="field">
            <span class="field-label">描述词（prompt）</span>
            <textarea
              v-model="originalPrompt"
              class="textarea"
              rows="4"
              placeholder="例如：一只小猫在草地上奔跑，电影感镜头，阳光、慢动作"
            ></textarea>
          </label>

          <div class="field-row">
            <label class="field">
              <span class="field-label">分辨率（size）</span>
              <select v-model="originalSize" class="select">
                <option value="1280x720">1280x720（720P 横屏）</option>
                <option value="720x1280">720x1280（720P 竖屏）</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">时长（秒）</span>
              <input
                v-model="originalDuration"
                class="input"
                type="number"
                min="4"
                max="60"
                step="1"
              />
            </label>
          </div>

          <div class="info-box">
            <strong>💡 Original 版说明：</strong>支持 4 秒以上，按秒计费（¥0.876/秒）
          </div>
        </div>

        <button class="btn primary" :disabled="creating" @click="handleCreate">
          {{ creating ? '创建中...' : '创建视频生成任务' }}
        </button>

        <div v-if="createResult" class="result">
          <div class="result-row">
            <span class="result-label">任务 ID：</span>
            <code class="result-value">{{ createResult.task_id || createResult.id }}</code>
          </div>
          <p class="tip">
            已自动填入到查询区域，可直接点击「查询任务状态」查看进度。
          </p>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">2. 查询任务状态</h2>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Token 类型</span>
            <select v-model="queryTokenType" class="select">
              <option value="default">廉价版（¥0.12/次）</option>
              <option value="premium">官方优质版（¥0.48/秒）</option>
              <option value="original">Original 版（¥0.876/秒）</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">API 格式</span>
            <select v-model="queryApiFormat" class="select">
              <option value="v2">/v2/videos/generations</option>
              <option value="v1">/v1/videos (OpenAI)</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span class="field-label">
            任务 ID（task_id）
            <span v-if="hasTaskId" class="tag">已从上一次创建自动填充</span>
          </span>
          <input
            v-model="queryTaskId"
            class="input"
            type="text"
            placeholder="例如：video_b9d05dda-0f9d-48c2-944e-7c5b47c6a399"
          />
        </label>

        <button class="btn" :disabled="querying" @click="handleQuery">
          {{ querying ? '查询中...' : '查询任务状态' }}
        </button>

        <div v-if="queryResult" class="result">
          <div class="result-row">
            <span class="result-label">状态：</span>
            <span class="status-pill" :data-status="queryResult.status">
              {{ queryResult.status }}
            </span>
          </div>

          <div class="result-row">
            <span class="result-label">进度：</span>
            <span class="result-value">{{ queryResult.progress }}%</span>
          </div>

          <div v-if="queryResult.model" class="result-row">
            <span class="result-label">模型：</span>
            <span class="result-value">{{ queryResult.model }}</span>
          </div>

          <div v-if="queryResult.seconds" class="result-row">
            <span class="result-label">时长：</span>
            <span class="result-value">{{ queryResult.seconds }} 秒</span>
          </div>

          <div v-if="queryResult.size" class="result-row">
            <span class="result-label">分辨率：</span>
            <span class="result-value">{{ queryResult.size }}</span>
          </div>

          <!-- 失败原因 -->
          <div v-if="queryResult.error" class="result-row">
            <span class="result-label">错误：</span>
            <div class="error-info">
              <div><strong>代码：</strong>{{ queryResult.error.code }}</div>
              <div><strong>信息：</strong>{{ queryResult.error.message }}</div>
            </div>
          </div>

          <!-- 视频链接（优先使用 url，其次 video_url，最后尝试 data.output） -->
          <div
            v-if="queryResult.url || queryResult.video_url || queryResult.data?.output"
            class="result-row"
          >
            <span class="result-label">视频地址：</span>
            <a
              class="link"
              :href="
                queryResult.url ||
                queryResult.video_url ||
                queryResult.data?.output
              "
              target="_blank"
              rel="noopener"
            >
              打开生成视频
            </a>
          </div>

          <details class="details">
            <summary>查看完整返回 JSON</summary>
            <pre class="json-preview">
{{ JSON.stringify(queryResult, null, 2) }}
            </pre>
          </details>
        </div>
      </div>
      </section>

      <!-- 右侧：fal.ai -->
      <section class="section right-section">
        <div class="section-header">
          <h2 class="section-title">fal.ai (Sora 2)</h2>
          <span class="section-badge">官方 SDK</span>
        </div>

        <!-- 创建任务 -->
        <div class="card">
          <h3 class="card-title">创建任务</h3>

          <label class="field">
            <span class="field-label">描述词（prompt）</span>
            <textarea
              v-model="falPrompt"
              class="textarea"
              rows="4"
              placeholder="例如：一只小猫在草地上奔跑，电影感镜头，阳光、慢动作"
            ></textarea>
          </label>

          <div class="field-row">
            <label class="field">
              <span class="field-label">分辨率</span>
              <select v-model="falResolution" class="select">
                <option value="720p">720P</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">画面比例</span>
              <select v-model="falAspectRatio" class="select">
                <option value="16:9">16:9（横屏）</option>
                <option value="9:16">9:16（竖屏）</option>
              </select>
            </label>
          </div>

          <div class="field-row">
            <label class="field">
              <span class="field-label">时长（秒）</span>
              <select v-model="falDuration" class="select">
                <option value="4">4 秒</option>
                <option value="8">8 秒</option>
                <option value="12">12 秒</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">模型版本</span>
              <select v-model="falModel" class="select">
                <option value="sora-2">sora-2（最新）</option>
                <option value="sora-2-2025-12-08">2025-12-08</option>
                <option value="sora-2-2025-10-06">2025-10-06</option>
              </select>
            </label>
          </div>

          <div class="info-box">
            <strong>💡 fal.ai 说明：</strong>支持 720P 分辨率，4/8/12 秒时长，按请求计费
          </div>

          <button
            class="btn primary"
            :disabled="creatingFal"
            @click="handleCreateFal"
          >
            {{ creatingFal ? '创建中...' : '创建视频生成任务' }}
          </button>

          <div v-if="falCreateResult" class="result">
            <div class="result-row">
              <span class="result-label">request_id：</span>
              <code class="result-value">{{ falCreateResult.request_id }}</code>
            </div>
            <p class="tip">
              已自动填入到查询区域，可直接点击「查询任务状态」查看进度。
            </p>
          </div>
        </div>

        <!-- 查询任务 -->
        <div class="card">
          <h3 class="card-title">查询任务状态</h3>

          <label class="field">
            <span class="field-label">
              请求 ID（request_id）
              <span v-if="falRequestId" class="tag">已自动填充</span>
            </span>
            <input
              v-model="falQueryRequestId"
              class="input"
              type="text"
              placeholder="例如：764cabcf-b745-4b3e-ae38-1200304cf45b"
            />
          </label>

          <button
            class="btn"
            :disabled="queryingFal"
            @click="handleQueryFal"
          >
            {{ queryingFal ? '查询中...' : '查询任务状态' }}
          </button>

          <div v-if="falQueryResult" class="result">
            <div class="result-row">
              <span class="result-label">状态：</span>
              <span class="status-pill" :data-status="falQueryResult.status">
                {{ falQueryResult.status }}
              </span>
            </div>

            <div v-if="falQueryResult.video_id" class="result-row">
              <span class="result-label">video_id：</span>
              <span class="result-value">{{ falQueryResult.video_id }}</span>
            </div>

            <!-- 视频链接 -->
            <div
              v-if="falQueryResult.video?.url"
              class="result-row"
            >
              <span class="result-label">视频地址：</span>
              <a
                class="link"
                :href="falQueryResult.video.url"
                target="_blank"
                rel="noopener"
              >
                打开生成视频
              </a>
            </div>

            <!-- 缩略图 -->
            <div
              v-if="falQueryResult.thumbnail?.url"
              class="result-row"
            >
              <span class="result-label">缩略图：</span>
              <a
                class="link"
                :href="falQueryResult.thumbnail.url"
                target="_blank"
                rel="noopener"
              >
                查看缩略图
              </a>
            </div>

            <details class="details">
              <summary>查看完整返回 JSON</summary>
              <pre class="json-preview">
{{ JSON.stringify(falQueryResult, null, 2) }}
              </pre>
            </details>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem;
  background: radial-gradient(circle at top, #1a2a3a 0, #050816 50%, #02010a 100%);
  color: #f9fafb;
  box-sizing: border-box;
}

.main-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  text-align: center;
}

.main-subtitle {
  font-size: 1rem;
  color: #9ca3af;
  margin-bottom: 1.5rem;
  text-align: center;
}

.container {
  width: 100%;
  max-width: 1600px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.section {
  background: rgba(15, 23, 42, 0.92);
  border-radius: 1.5rem;
  padding: 1.5rem 2rem;
  box-shadow:
    0 20px 45px rgba(15, 23, 42, 0.8),
    0 0 0 1px rgba(148, 163, 184, 0.15);
  backdrop-filter: blur(18px);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.section-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #f9fafb;
}

.section-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
  font-weight: 500;
}

.card {
  background: radial-gradient(circle at top left, #111827, #020617);
  border-radius: 1.1rem;
  padding: 1.5rem 1.6rem 1.4rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.18);
  margin-bottom: 1.5rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #e5e7eb;
}

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
}

.field-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.field-label {
  font-size: 0.85rem;
  color: #9ca3af;
  margin-bottom: 0.35rem;
}

.textarea,
.input,
.select {
  font: inherit;
  border-radius: 0.75rem;
  border: 1px solid rgba(75, 85, 99, 0.8);
  padding: 0.55rem 0.75rem;
  background: rgba(15, 23, 42, 0.9);
  color: #f9fafb;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.textarea:focus,
.input:focus,
.select:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.4);
  background: rgba(15, 23, 42, 0.95);
}

.textarea::placeholder,
.input::placeholder {
  color: #4b5563;
}

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.9rem;
  color: #e5e7eb;
  margin-bottom: 1rem;
}

.checkbox input {
  width: 1rem;
  height: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  background: linear-gradient(135deg, #020617, #020617);
  color: #e5e7eb;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.08s ease,
    border-color 0.18s ease;
}

.btn.primary {
  background: radial-gradient(circle at top left, #38bdf8, #0ea5e9);
  border-color: transparent;
  color: #0b1120;
  font-weight: 600;
}

.btn:hover:not(:disabled) {
  box-shadow:
    0 12px 30px rgba(15, 23, 42, 0.8),
    0 0 0 1px rgba(148, 163, 184, 0.4);
  transform: translateY(-1px);
}

.btn.primary:hover:not(:disabled) {
  box-shadow:
    0 12px 35px rgba(56, 189, 248, 0.65),
    0 0 0 1px rgba(56, 189, 248, 0.35);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.result {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(55, 65, 81, 0.9);
  font-size: 0.9rem;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.result-label {
  color: #9ca3af;
}

.result-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  word-break: break-all;
}

.tip {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 0.15rem;
}

.alert {
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  font-size: 0.88rem;
  margin-bottom: 1rem;
}

.alert-error {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.6);
  color: #fecaca;
}

.status-pill {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  background: rgba(55, 65, 81, 0.9);
}

.status-pill[data-status='SUCCESS'],
.status-pill[data-status='completed'] {
  background: rgba(34, 197, 94, 0.18);
  color: #bbf7d0;
}

.status-pill[data-status='PENDING'],
.status-pill[data-status='RUNNING'],
.status-pill[data-status='queued'],
.status-pill[data-status='in_progress'] {
  background: rgba(56, 189, 248, 0.18);
  color: #bae6fd;
}

.status-pill[data-status='FAILED'],
.status-pill[data-status='failed'] {
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
}

.error-info {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: #fecaca;
  line-height: 1.6;
}

.error-info strong {
  color: #f87171;
}

.tag {
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.1);
  color: #7dd3fc;
  font-size: 0.7rem;
}

.details {
  margin-top: 0.6rem;
}

.details > summary {
  cursor: pointer;
  font-size: 0.8rem;
  color: #9ca3af;
}

.json-preview {
  margin-top: 0.4rem;
  font-size: 0.78rem;
  max-height: 260px;
  overflow: auto;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 0.75rem;
  padding: 0.75rem;
  border: 1px solid rgba(31, 41, 55, 0.9);
}

.link {
  color: #7dd3fc;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid rgba(55, 65, 81, 0.5);
  padding-bottom: 0;
}

.tab {
  flex: 1;
  padding: 0.65rem 1rem;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;
  border-radius: 0.5rem 0.5rem 0 0;
  position: relative;
}

.tab:hover {
  color: #e5e7eb;
  background: rgba(55, 65, 81, 0.3);
}

.tab.active {
  color: #38bdf8;
  font-weight: 600;
  background: rgba(56, 189, 248, 0.1);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #38bdf8;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.info-box {
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: #bae6fd;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.info-box strong {
  color: #7dd3fc;
}

@media (max-width: 1200px) {
  .container {
    grid-template-columns: 1fr;
  }

  .section {
    max-width: 880px;
    margin: 0 auto;
  }
}

@media (max-width: 720px) {
  .page {
    padding: 1.5rem 1rem;
  }

  .main-title {
    font-size: 1.5rem;
  }

  .main-subtitle {
    font-size: 0.9rem;
  }

  .section {
    padding: 1.25rem 1.5rem;
  }

  .field-row {
    flex-direction: column;
  }

  .tab {
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
  }

  .section-title {
    font-size: 1.1rem;
  }

  .section-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
  }
}
</style>
