<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  id: Number,
  x: Number,
  y: Number,
  data: Object,
  selected: Boolean
})

const emit = defineEmits(['update:position', 'update:data', 'select', 'delete', 'show-details'])

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const elapsedSeconds = ref(0)
const startTime = ref(0)
const timer = ref(null)
const localPrompt = ref(props.data.prompt || '')
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

const statusText = computed(() => {
  switch (props.data.status) {
    case 'idle': return '待生成'
    case 'creating': return '创建中...'
    case 'queued': return '排队中'
    case 'in_progress': return '生成中'
    case 'completed': return '已完成'
    case 'failed': return '生成失败'
    default: return '未知状态'
  }
})

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'completed': return '#10b981'
    case 'failed': return '#ef4444'
    case 'queued':
    case 'in_progress': return '#f59e0b'
    default: return '#64748b'
  }
})

const duration = computed(() => {
  return parseInt(props.data.duration) || 4
})

// 计算费用：按视频长度计费，0.1刀/秒
const cost = computed(() => {
  return (duration.value * 0.1).toFixed(2)
})

// 倒计时显示文本
const countdownDisplay = computed(() => {
  const remaining = 200 - elapsedSeconds.value
  if (remaining >= 0) return remaining
  return `+${Math.abs(remaining)}`
})

// 倒计时进度百分比
const countdownProgress = computed(() => {
  const remaining = 200 - elapsedSeconds.value
  if (remaining < 0) return 100
  return ((200 - remaining) / 200 * 100).toFixed(1)
})

// 按钮文本
const buttonText = computed(() => {
  switch (props.data.status) {
    case 'idle':
      return '生成视频'
    case 'creating':
      return '创建中...'
    case 'queued':
      return '排队中...'
    case 'in_progress':
      return '生成中...'
    case 'completed':
      return '重新生成'
    case 'failed':
      return '重试'
    default:
      return '生成视频'
  }
})

// 按钮是否可用
const isButtonDisabled = computed(() => {
  return props.data.status !== 'idle' && 
         props.data.status !== 'failed' && 
         props.data.status !== 'completed'
})

// 清理定时器
onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value)
  }
})

const startDrag = (e) => {
  isDragging.value = true
  dragStart.value = {
    x: e.clientX - props.x,
    y: e.clientY - props.y
  }
  emit('select', props.id)
  
  // 防止文本选择
  e.preventDefault()
  
  const onMouseMove = (e) => {
    if (isDragging.value) {
      // 使用 requestAnimationFrame 优化性能
      requestAnimationFrame(() => {
        emit('update:position', props.id, e.clientX - dragStart.value.x, e.clientY - dragStart.value.y)
      })
    }
  }
  
  const onMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const handleDelete = () => {
  // 清理定时器
  if (timer.value) {
    clearInterval(timer.value)
  }
  emit('delete', props.id)
}

const updatePrompt = (e) => {
  localPrompt.value = e.target.value
  emit('update:data', props.id, { prompt: e.target.value })
}

const generate = async () => {
  if (!localPrompt.value.trim()) {
    alert('请输入描述词')
    return
  }

  // 清理之前的定时器
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
  
  // 重置状态
  elapsedSeconds.value = 0
  startTime.value = 0
  
  emit('update:data', props.id, { 
    status: 'creating',
    videoUrl: null,
    requestId: null,
    error: '', // 明确清除错误
    resultData: null // 清除旧的详情数据
  })

  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/ai/fal/sora-2/text-to-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: localPrompt.value,
        resolution: '720p',
        aspect_ratio: '16:9',
        duration: duration.value,
        model: 'sora-2'
      })
    })

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '创建任务失败')
    }

    const requestId = data.data?.request_id

    emit('update:data', props.id, { 
      status: 'queued',
      requestId,
      resultData: data // 保存创建结果
    })

    // 开始计时
    startTime.value = Date.now()
    timer.value = setInterval(() => {
      const now = Date.now()
      elapsedSeconds.value = Math.floor((now - startTime.value) / 1000)
      
      const es = elapsedSeconds.value
      // 轮询策略: 5s, 10s, 15s... 加快轮询频率以获得更好体验
      if (es % 5 === 0) {
        pollStatus(requestId)
      }
    }, 1000)

  } catch (err) {
    emit('update:data', props.id, { 
      status: 'failed',
      error: err.message,
      resultData: { error: err.message }
    })
  }
}

const pollStatus = async (requestId) => {
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/ai/fal/sora-2/text-to-video/${requestId}`)
    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || '查询失败')
    }

    const status = data.data?.status
    const videoUrl = data.data?.video?.url

    emit('update:data', props.id, { 
      status,
      videoUrl: videoUrl || null,
      resultData: data // 更新状态详情
    })

    if (status === 'completed' || status === 'failed') {
      if (timer.value) {
        clearInterval(timer.value)
        timer.value = null
      }
    }
  } catch (err) {
    if (timer.value) {
      clearInterval(timer.value)
      timer.value = null
    }
    emit('update:data', props.id, { 
      status: 'failed',
      error: err.message,
      resultData: { error: err.message }
    })
  }
}
</script>

<template>
  <div 
    class="node video-node"
    :class="{ selected, dragging: isDragging }"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div class="node-header" @mousedown="startDrag">
      <span class="node-icon">🎬</span>
      <span class="node-title">Sora 2 视频生成</span>
      <button class="delete-btn" @click.stop="handleDelete">×</button>
    </div>
    <div class="node-content">
      <div class="field">
        <label>描述词</label>
        <textarea 
          :value="localPrompt" 
          @input="updatePrompt"
          @click.stop
          placeholder="描述你想要生成的视频..."
          rows="3"
          :disabled="isButtonDisabled"
        ></textarea>
      </div>

      <div class="field">
        <label>时长</label>
        <select 
          :value="duration" 
          @change="emit('update:data', id, { duration: $event.target.value })"
          :disabled="isButtonDisabled"
        >
          <option value="4">4秒</option>
          <option value="8">8秒</option>
          <option value="12">12秒</option>
        </select>
      </div>

      <button 
        class="generate-btn"
        @click.stop="generate"
        :disabled="isButtonDisabled"
        :class="{ 
          'btn-success': data.status === 'completed',
          'btn-warning': data.status === 'failed'
        }"
      >
        {{ buttonText }}
      </button>

      <div class="status-bar">
        <div class="status-indicator" :style="{ background: statusColor }"></div>
        <span class="status-text">{{ statusText }}</span>
        <button v-if="data.resultData" class="detail-btn" @click.stop="$emit('show-details', data.resultData)">详情</button>
        <span class="cost-text">${{ cost }}</span>
      </div>

      <!-- 倒计时进度条 -->
      <div v-if="data.status !== 'idle' && data.status !== 'completed' && data.status !== 'failed'" class="countdown-container">
        <div class="countdown-header">
          <span class="countdown-label">正在生成</span>
          <span class="countdown-time">{{ countdownDisplay }}s</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: countdownProgress + '%' }"></div>
        </div>
      </div>

      <div v-if="data.videoUrl" class="video-preview">
        <video :src="data.videoUrl" controls></video>
      </div>

      <div v-if="data.error" class="error-message">
        {{ data.error }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.node {
  position: absolute;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  min-width: 320px;
  min-height: 200px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Enable resize */
  resize: both;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.node.dragging {
  transition: none;
  opacity: 0.9;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.node.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  background: white;
  user-select: none;
  cursor: grab;
  flex-shrink: 0;
}

.node-header:active {
  cursor: grabbing;
}

.node-icon {
  font-size: 16px;
}

.node-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.delete-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: #f1f5f9;
  color: #94a3b8;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.node-content {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

textarea, select {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  background: #f8fafc;
  color: #334155;
}

textarea {
  resize: vertical;
  min-height: 60px;
}

textarea:focus, select:focus {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.generate-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
}

.generate-btn.btn-success {
  background: #10b981;
}

.generate-btn.btn-warning {
  background: #f59e0b;
}

.generate-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  margin-bottom: 12px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-text {
  flex: 1;
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

.detail-btn {
  font-size: 12px;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 4px;
}

.detail-btn:hover {
  color: #3b82f6;
}

.cost-text {
  font-size: 12px;
  font-weight: 600;
  color: #10b981;
}

.video-preview {
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
  flex: 1;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview video {
  width: 100%;
  height: 100%;
  max-height: 300px;
  object-fit: contain;
}

.countdown-container {
  margin-top: 12px;
  padding: 12px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.countdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.countdown-label {
  font-size: 12px;
  color: #0369a1;
  font-weight: 600;
}

.countdown-time {
  font-size: 13px;
  color: #0c4a6e;
  font-weight: 700;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #e0f2fe;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #38bdf8;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.error-message {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  color: #ef4444;
  font-size: 12px;
  word-break: break-all;
}
</style>