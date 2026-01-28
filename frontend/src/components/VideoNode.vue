<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  id: Number,
  x: Number,
  y: Number,
  data: Object,
  selected: Boolean
})

const emit = defineEmits(['update:position', 'update:data', 'select', 'delete'])

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const localPrompt = ref(props.data.prompt || '')
const countdown = ref(0)
const countdownTimer = ref(null)

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
    default: return '#6b7280'
  }
})

const duration = computed(() => {
  return parseInt(props.data.duration) || 4
})

// 计算费用：按视频长度计费，0.1刀/秒
const cost = computed(() => {
  return (duration.value * 0.1).toFixed(2)
})

// 倒计时进度百分比
const countdownProgress = computed(() => {
  if (countdown.value <= 0) return 100
  return ((200 - countdown.value) / 200 * 100).toFixed(1)
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
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }
  if (props.data.pollTimer) {
    clearInterval(props.data.pollTimer)
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
  if (props.data.pollTimer) {
    clearInterval(props.data.pollTimer)
  }
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
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
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
  if (props.data.pollTimer) {
    clearInterval(props.data.pollTimer)
  }
  
  // 重置状态
  countdown.value = 0
  
  emit('update:data', props.id, { 
    status: 'creating',
    videoUrl: null,
    requestId: null,
    pollTimer: null
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
      requestId
    })

    // 开始200秒倒计时
    countdown.value = 200
    countdownTimer.value = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(countdownTimer.value)
        countdownTimer.value = null
      }
    }, 1000)

    // 200秒后开始轮询，每5秒一次
    setTimeout(() => {
      startPolling(requestId)
    }, 200000) // 200秒 = 200000毫秒

  } catch (err) {
    emit('update:data', props.id, { 
      status: 'failed',
      error: err.message
    })
  }
}

const startPolling = (requestId) => {
  const pollTimer = setInterval(async () => {
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
        videoUrl: videoUrl || null
      })

      if (status === 'completed' || status === 'failed') {
        clearInterval(pollTimer)
        emit('update:data', props.id, { pollTimer: null })
      }
    } catch (err) {
      clearInterval(pollTimer)
      emit('update:data', props.id, { 
        status: 'failed',
        error: err.message,
        pollTimer: null
      })
    }
  }, 5000) // 每5秒轮询一次

  emit('update:data', props.id, { pollTimer })
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
        <span class="cost-text">${{ cost }}</span>
      </div>

      <!-- 倒计时进度条 -->
      <div v-if="countdown > 0" class="countdown-container">
        <div class="countdown-header">
          <span class="countdown-label">等待开始轮询</span>
          <span class="countdown-time">{{ countdown }}秒</span>
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
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  min-width: 320px;
  max-width: 400px;
  cursor: move;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.node.dragging {
  transition: none;
  opacity: 0.9;
}

.node.selected {
  border-color: #3b82f6;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 10px 10px 0 0;
  user-select: none;
}

.node-icon {
  font-size: 18px;
}

.node-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.delete-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.node-content {
  padding: 16px;
}

.field {
  margin-bottom: 12px;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
}

textarea, select {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  background: white;
}

textarea {
  resize: none;
}

textarea:focus, select:focus {
  border-color: #3b82f6;
}

textarea:disabled, select:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.generate-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
}

.generate-btn.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
}

.generate-btn.btn-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.generate-btn.btn-success:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.generate-btn.btn-warning:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
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
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 12px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-text {
  flex: 1;
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.cost-text {
  font-size: 13px;
  font-weight: 700;
  color: #10b981;
}

.video-preview {
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  max-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview video {
  width: 100%;
  max-height: 200px;
  display: block;
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
  margin-bottom: 8px;
}

.countdown-label {
  font-size: 12px;
  color: #0369a1;
  font-weight: 600;
}

.countdown-time {
  font-size: 14px;
  color: #0c4a6e;
  font-weight: 700;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e0f2fe;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #0ea5e9);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.error-message {
  padding: 8px 12px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 12px;
}
</style>
