<script setup>
import { ref, computed } from 'vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Comfly Chat 参数
const comflyPrompt = ref('')
const comflyTokenType = ref('default')
const comflyDuration = ref('10')
const comflyAspectRatio = ref('16:9')

const comflyCreating = ref(false)
const comflyResult = ref(null)

// 查询参数
const queryTaskId = ref('')
const queryTokenType = ref('default')
const querying = ref(false)
const queryResult = ref(null)

const errorMessage = ref('')

const handleComflyCreate = async () => {
  if (!comflyPrompt.value.trim()) {
    errorMessage.value = '请输入描述词'
    return
  }

  comflyCreating.value = true
  comflyResult.value = null
  errorMessage.value = ''

  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/ai/comfly/sora-2/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: comflyPrompt.value,
        aspect_ratio: comflyAspectRatio.value,
        duration: comflyDuration.value,
        token_type: comflyTokenType.value,
        hd: false
      })
    })

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '创建任务失败')
    }

    comflyResult.value = data.data
    queryTaskId.value = data.data?.task_id || data.data?.id || ''
    queryTokenType.value = comflyTokenType.value
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    comflyCreating.value = false
  }
}

const handleQuery = async () => {
  if (!queryTaskId.value.trim()) {
    errorMessage.value = '请输入任务 ID'
    return
  }

  querying.value = true
  queryResult.value = null
  errorMessage.value = ''

  try {
    const resp = await fetch(
      `${apiBaseUrl}/api/v1/ai/comfly/sora-2/generations/${encodeURIComponent(queryTaskId.value)}?token_type=${queryTokenType.value}`
    )

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '查询失败')
    }

    queryResult.value = data.data
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    querying.value = false
  }
}
</script>

<template>
  <div class="playground">
    <div class="playground-header">
      <h2>API Playground</h2>
      <p>测试其他还未完成的 API</p>
    </div>

    <div v-if="errorMessage" class="alert error">
      {{ errorMessage }}
    </div>

    <div class="section">
      <h3>Comfly Chat - 创建任务</h3>
      
      <div class="field">
        <label>Token 类型</label>
        <select v-model="comflyTokenType">
          <option value="default">廉价版（¥0.12/次）</option>
          <option value="premium">官方优质版（¥0.48/秒）</option>
          <option value="original">Original 版（¥0.876/秒）</option>
        </select>
      </div>

      <div class="field">
        <label>描述词</label>
        <textarea v-model="comflyPrompt" rows="3" placeholder="描述你想要生成的视频..."></textarea>
      </div>

      <div class="field-row">
        <div class="field">
          <label>画面比例</label>
          <select v-model="comflyAspectRatio">
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
        </div>

        <div class="field">
          <label>时长（秒）</label>
          <select v-model="comflyDuration">
            <option value="10">10</option>
            <option value="15">15</option>
          </select>
        </div>
      </div>

      <button class="btn primary" @click="handleComflyCreate" :disabled="comflyCreating">
        {{ comflyCreating ? '创建中...' : '创建任务' }}
      </button>

      <div v-if="comflyResult" class="result">
        <div class="result-item">
          <span class="label">任务 ID:</span>
          <code>{{ comflyResult.task_id || comflyResult.id }}</code>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>查询任务状态</h3>

      <div class="field">
        <label>Token 类型</label>
        <select v-model="queryTokenType">
          <option value="default">廉价版</option>
          <option value="premium">官方优质版</option>
          <option value="original">Original 版</option>
        </select>
      </div>

      <div class="field">
        <label>任务 ID</label>
        <input v-model="queryTaskId" placeholder="输入任务 ID" />
      </div>

      <button class="btn" @click="handleQuery" :disabled="querying">
        {{ querying ? '查询中...' : '查询状态' }}
      </button>

      <div v-if="queryResult" class="result">
        <div class="result-item">
          <span class="label">状态:</span>
          <span class="status" :class="queryResult.status">{{ queryResult.status }}</span>
        </div>
        <div class="result-item">
          <span class="label">进度:</span>
          <span>{{ queryResult.progress }}%</span>
        </div>
        <div v-if="queryResult.url || queryResult.video_url" class="result-item">
          <span class="label">视频:</span>
          <a :href="queryResult.url || queryResult.video_url" target="_blank">打开视频</a>
        </div>
        <details>
          <summary>完整响应</summary>
          <pre>{{ JSON.stringify(queryResult, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playground {
  padding: 32px;
  max-width: 800px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100vh;
  background: #fafafa;
}

.playground-header {
  margin-bottom: 32px;
}

.playground-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px 0;
}

.playground-header p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.section h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 20px 0;
}

.field {
  margin-bottom: 16px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

input, textarea, select {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

input:focus, textarea:focus, select:focus {
  border-color: #3b82f6;
}

textarea {
  resize: vertical;
}

.btn {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn.primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
}

.btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
}

.alert.error {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.result {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.result-item .label {
  font-weight: 600;
  color: #6b7280;
}

.result-item code {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.result-item a {
  color: #3b82f6;
  text-decoration: none;
}

.result-item a:hover {
  text-decoration: underline;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status.completed {
  background: #d1fae5;
  color: #065f46;
}

.status.queued,
.status.in_progress {
  background: #fef3c7;
  color: #92400e;
}

.status.failed {
  background: #fee2e2;
  color: #991b1b;
}

details {
  margin-top: 16px;
}

details summary {
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
}

details pre {
  margin-top: 8px;
  background: #f9fafb;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  border: 1px solid #e5e7eb;
}
</style>
