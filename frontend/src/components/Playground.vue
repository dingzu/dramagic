<script setup>
import { ref, computed } from 'vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// 布局状态
const widgets = ref(['create', 'query'])
const draggedItem = ref(null)

// Modal 状态
const showModal = ref(false)
const modalTitle = ref('')
const modalContent = ref(null)

const openModal = (title, content) => {
  modalTitle.value = title
  modalContent.value = content
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  modalContent.value = null
}

// Comfly Chat 参数
const comflyPrompt = ref('')
const comflyTokenType = ref('default')
const comflyDuration = ref('10')
const comflyAspectRatio = ref('16:9')

const comflyCreating = ref(false)
const comflyResult = ref(null)
const comflyError = ref('')

// 查询参数
const queryTaskId = ref('')
const queryTokenType = ref('default')
const querying = ref(false)
const queryResult = ref(null)
const queryError = ref('')

// 拖拽处理
const handleDragStart = (e, item) => {
  draggedItem.value = item
  e.dataTransfer.effectAllowed = 'move'
  e.target.style.opacity = '0.5'
}

const handleDragEnd = (e) => {
  draggedItem.value = null
  e.target.style.opacity = '1'
}

const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleDrop = (e, targetItem) => {
  e.preventDefault()
  if (draggedItem.value === targetItem) return
  
  const oldIndex = widgets.value.indexOf(draggedItem.value)
  const newIndex = widgets.value.indexOf(targetItem)
  
  widgets.value.splice(oldIndex, 1)
  widgets.value.splice(newIndex, 0, draggedItem.value)
}

const handleComflyCreate = async () => {
  if (!comflyPrompt.value.trim()) {
    comflyError.value = '请输入描述词'
    return
  }

  comflyCreating.value = true
  comflyResult.value = null
  comflyError.value = ''

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
    comflyError.value = err.message
  } finally {
    comflyCreating.value = false
  }
}

const handleQuery = async () => {
  if (!queryTaskId.value.trim()) {
    queryError.value = '请输入任务 ID'
    return
  }

  querying.value = true
  queryResult.value = null
  queryError.value = ''

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
    queryError.value = err.message
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

    <div class="widgets-container">
      <div 
        v-for="widget in widgets" 
        :key="widget"
        class="widget-wrapper"
        draggable="true"
        @dragstart="handleDragStart($event, widget)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver"
        @drop="handleDrop($event, widget)"
      >
        <!-- 创建任务卡片 -->
        <div v-if="widget === 'create'" class="card section">
          <div class="card-header">
            <h3>Comfly Chat - 创建任务</h3>
            <div class="drag-handle">⋮⋮</div>
          </div>
          
          <div v-if="comflyError" class="alert error">
            {{ comflyError }}
          </div>

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
            <div class="result-header">
              <span class="result-title">创建成功</span>
              <button class="btn-text" @click="openModal('创建结果', comflyResult)">查看详情</button>
            </div>
            <div class="result-item">
              <span class="label">任务 ID:</span>
              <code>{{ comflyResult.task_id || comflyResult.id }}</code>
            </div>
          </div>
        </div>

        <!-- 查询任务卡片 -->
        <div v-if="widget === 'query'" class="card section">
          <div class="card-header">
            <h3>查询任务状态</h3>
            <div class="drag-handle">⋮⋮</div>
          </div>

          <div v-if="queryError" class="alert error">
            {{ queryError }}
          </div>

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
            <div class="result-header">
              <span class="result-title">查询结果</span>
              <button class="btn-text" @click="openModal('查询结果', queryResult)">查看详情</button>
            </div>
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
          </div>
        </div>
      </div>
    </div>

    <!-- JSON Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ modalTitle }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <pre>{{ JSON.stringify(modalContent, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playground {
  width: 100%;
  padding: 40px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100vh;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.playground-header {
  margin-bottom: 40px;
  text-align: center;
}

.playground-header h2 {
  font-size: 32px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
}

.playground-header p {
  font-size: 16px;
  color: #64748b;
  margin: 0;
}

.widgets-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 40px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s, box-shadow 0.2s;
  /* 性能：减少 resize 期间的整体重排/重绘影响范围 */
  contain: layout paint;
  /* 性能：提示浏览器本元素尺寸会频繁变化（resize） */
  will-change: width, height;
  
  /* Enable resize */
  resize: both;
  overflow: auto;
  min-width: 300px;
  min-height: 200px;
}

.card:active {
  /* 性能：拉伸/拖动时避免过渡和昂贵阴影插值 */
  transition: none;
  box-shadow: 0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
}

.card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  cursor: grab;
}

.card-header:active {
  cursor: grabbing;
}

.card h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.drag-handle {
  color: #94a3b8;
  font-size: 20px;
  cursor: grab;
  user-select: none;
}

.field {
  margin-bottom: 20px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

input, textarea, select {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  background: #fff;
  transition: all 0.2s;
  color: #334155;
}

input:focus, textarea:focus, select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

textarea {
  resize: vertical;
}

.btn {
  width: 100%;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}

.btn.primary {
  background: #3b82f6;
  color: white;
  border: none;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.btn.primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.4);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 13px;
  display: flex;
  align-items: center;
}

.alert.error {
  background: #fef2f2;
  border: 1px solid #fee2e2;
  color: #ef4444;
}

.result {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f1f5f9;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.btn-text {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.btn-text:hover {
  text-decoration: underline;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  color: #334155;
}

.result-item .label {
  font-weight: 500;
  color: #64748b;
  width: 60px;
}

.result-item code {
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  font-family: 'SF Mono', 'Roboto Mono', Menlo, monospace;
}

.result-item a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.result-item a:hover {
  text-decoration: underline;
}

.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status.completed {
  background: #dcfce7;
  color: #166534;
}

.status.queued,
.status.in_progress {
  background: #fef9c3;
  color: #854d0e;
}

.status.failed {
  background: #fee2e2;
  color: #991b1b;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: modalIn 0.2s ease-out;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #64748b;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.modal-body pre {
  margin: 0;
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  font-size: 13px;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  color: #334155;
}
</style>
