<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import pricing from '../../../config/pricing.js'

const props = defineProps({
  id: Number,
  x: Number,
  y: Number,
  data: Object,
  selected: Boolean,
  projectId: [Number, String]
})

const emit = defineEmits(['update:position', 'update:data', 'select', 'delete', 'show-details', 'drag-end'])

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const elapsedSeconds = ref(0)
const startTime = ref(0)
const timer = ref(null)
const localPrompt = ref(props.data.prompt || '')
const localSource = ref(props.data.source || 'fal') // 'fal' 或 'comfly-premium'
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

// 拖拽性能：每帧最多触发一次位置更新（避免每个 mousemove 都排一个 rAF）
let dragRafId = null
let pendingPos = null

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

// 当前来源
const source = computed(() => {
  return props.data.source || localSource.value || 'fal'
})

// 计算费用：根据来源使用不同的 pricing 配置
const costInfo = computed(() => {
  if (source.value === 'comfly-premium') {
    return pricing.calculateCost('comfly', 'premium', duration.value)
  }
  if (source.value === 'comfly-original') {
    return pricing.calculateCost('comfly', 'original', duration.value)
  }
  return pricing.calculateCost('fal', 'sora-2', duration.value)
})

// 美元价格
const costUSD = computed(() => {
  return costInfo.value?.priceUSD?.toFixed(2) || '0.00'
})

// 人民币价格
const costCNY = computed(() => {
  return costInfo.value?.priceCNY?.toFixed(2) || '0.00'
})

// 来源显示名称
const sourceLabel = computed(() => {
  if (source.value === 'comfly-premium') return 'Comfly 官方'
  if (source.value === 'comfly-original') return 'Comfly Original'
  return 'fal.ai'
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
      pendingPos = {
        x: e.clientX - dragStart.value.x,
        y: e.clientY - dragStart.value.y
      }

      if (dragRafId == null) {
        dragRafId = requestAnimationFrame(() => {
          dragRafId = null
          if (!pendingPos) return
          emit('update:position', props.id, pendingPos.x, pendingPos.y)
        })
      }
    }
  }
  
  const onMouseUp = () => {
    isDragging.value = false
    if (dragRafId != null) {
      cancelAnimationFrame(dragRafId)
      dragRafId = null
    }
    // 拖拽结束，通知父组件进行同步
    if (pendingPos) {
      emit('update:position', props.id, pendingPos.x, pendingPos.y)
    }
    emit('drag-end', props.id)
    pendingPos = null
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

const startOrResumeTimer = (requestId, startTs) => {
  if (!requestId) return

  // 清理旧定时器
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }

  const ts = Number(startTs) || Date.now()
  startTime.value = ts
  elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - ts) / 1000))

  // 立即拉一次状态，避免用户打开后还要等 5s
  pollStatus(requestId)

  timer.value = setInterval(() => {
    elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - startTime.value) / 1000))
    const es = elapsedSeconds.value
    if (es % 5 === 0) {
      pollStatus(requestId)
    }
  }, 1000)
}

onMounted(() => {
  // 项目重启/重新打开后：如果有未完成任务，继续轮询直到完成
  const status = props.data?.status
  const requestId = props.data?.requestId
  const startTs = props.data?.startTime
  const shouldResume = (status === 'queued' || status === 'in_progress' || status === 'creating') && requestId
  if (shouldResume) {
    startOrResumeTimer(requestId, startTs)
  }
})

// 切换项目/加载数据时，确保本地输入框与数据源同步（避免“默认参数串上一次项目”）
watch(
  () => props.data?.prompt,
  (v) => {
    localPrompt.value = v || ''
  }
)

// 同步 source 来源
watch(
  () => props.data?.source,
  (v) => {
    localSource.value = v || 'fal'
  }
)

// 如果加载项目后才拿到 requestId/status，也要自动恢复轮询
watch(
  () => [props.data?.status, props.data?.requestId, props.data?.startTime],
  ([status, requestId, startTs]) => {
    const shouldResume = (status === 'queued' || status === 'in_progress' || status === 'creating') && requestId
    if (shouldResume && !timer.value) {
      startOrResumeTimer(requestId, startTs)
    }
  }
)

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
  
  // 保存当前使用的来源
  const currentSource = localSource.value
  
  emit('update:data', props.id, { 
    status: 'creating',
    videoUrl: null,
    requestId: null,
    error: '', // 明确清除错误
    resultData: null, // 清除旧的详情数据
    source: currentSource // 保存来源
  })

  try {
    let resp, data, requestId

    if (currentSource === 'comfly-premium' || currentSource === 'comfly-original') {
      // Comfly Chat（官方优质版 / Original版）
      const tokenType = currentSource === 'comfly-premium' ? 'premium' : 'original'
      resp = await fetch(`${apiBaseUrl}/api/v1/ai/comfly/sora-2/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: localPrompt.value,
          model: 'sora-2',
          size: '1280x720',
          seconds: String(duration.value),
          watermark: false,
          token_type: tokenType
        })
      })

      data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data.error || data.message || '创建任务失败')
      }

      requestId = data.data?.id // Comfly 返回的是 id
    } else {
      // fal.ai
      resp = await fetch(`${apiBaseUrl}/api/v1/ai/fal/sora-2/text-to-video`, {
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

      data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data.error || data.message || '创建任务失败')
      }

      requestId = data.data?.request_id // fal 返回的是 request_id
    }

    const startTs = Date.now()

    emit('update:data', props.id, { 
      status: 'queued',
      requestId,
      startTime: startTs,
      resultData: data, // 保存创建结果
      source: currentSource
    })

    // 开始计时
    startOrResumeTimer(requestId, startTs)

  } catch (err) {
    emit('update:data', props.id, { 
      status: 'failed',
      error: err.message,
      resultData: { error: err.message }
    })
  }
}

// 保存视频到 OSS 和数据库
const saveVideoToOss = async (videoUrl, requestId) => {
  try {
    const currentSource = props.data?.source || 'fal'
    const cost = costInfo.value
    
    const resp = await fetch(`${apiBaseUrl}/api/v1/video-tasks/save-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'admin',
        project_id: props.projectId || null,
        prompt: localPrompt.value || props.data?.prompt,
        duration: duration.value,
        source: currentSource,
        source_task_id: requestId,
        source_video_url: videoUrl,
        cost_usd: cost?.priceUSD || null,
        cost_cny: cost?.priceCNY || null
      })
    })

    const data = await resp.json()
    
    if (data.success && data.data?.task?.oss_url) {
      // 更新节点使用 OSS URL（公共读 Bucket）
      emit('update:data', props.id, { 
        ossUrl: data.data.task.oss_url,
        ossPath: data.data.task.oss_path,
        taskId: data.data.task.id
      })
      console.log('✅ 视频已保存到 OSS:', data.data.task.oss_url)
    } else if (data.success) {
      console.log('📝 任务已记录（OSS 未配置或上传失败）')
    }
  } catch (err) {
    console.error('保存视频失败:', err.message)
    // 不影响主流程，仅记录错误
  }
}

// 获取视频预览 URL（优先使用 OSS URL）
const previewVideoUrl = computed(() => {
  // 优先使用 OSS URL
  if (props.data?.ossUrl) {
    return props.data.ossUrl
  }
  // 其次使用原始视频 URL
  return props.data?.videoUrl || null
})

const pollStatus = async (requestId) => {
  try {
    const currentSource = props.data?.source || 'fal'
    let resp, data, status, videoUrl

    if (currentSource === 'comfly-premium' || currentSource === 'comfly-original') {
      // Comfly Chat（官方优质版 / Original版）查询
      const tokenType = currentSource === 'comfly-premium' ? 'premium' : 'original'
      resp = await fetch(`${apiBaseUrl}/api/v1/ai/comfly/sora-2/videos/${requestId}?token_type=${tokenType}`)
      data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data.error || '查询失败')
      }

      status = data.data?.status
      videoUrl = data.data?.video_url // Comfly 返回的是 video_url
    } else {
      // fal.ai 查询
      resp = await fetch(`${apiBaseUrl}/api/v1/ai/fal/sora-2/text-to-video/${requestId}`)
      data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data.error || '查询失败')
      }

      status = data.data?.status
      videoUrl = data.data?.video?.url // fal 返回的是 video.url
    }

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

      // 视频生成完成，自动保存到 OSS
      if (status === 'completed' && videoUrl) {
        saveVideoToOss(videoUrl, requestId)
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
    :style="{ transform: `translate3d(${x}px, ${y}px, 0)` }"
  >
    <div class="node-header" @mousedown="startDrag">
      <span class="node-icon">🎬</span>
      <span class="node-title">Sora 2 视频生成</span>
      <span class="source-badge" :class="source">{{ sourceLabel }}</span>
      <button class="delete-btn" @click.stop="handleDelete">×</button>
    </div>
    <div class="node-content">
      <div class="field">
        <label>来源</label>
        <select 
          :value="localSource" 
          @change="localSource = $event.target.value; emit('update:data', id, { source: $event.target.value })"
          @click.stop
          :disabled="isButtonDisabled"
        >
          <option value="fal">fal.ai（¥0.73/秒）</option>
          <option value="comfly-premium">Comfly 官方优质版（¥0.48/秒）</option>
          <option value="comfly-original">Comfly Original（¥0.88/秒）</option>
        </select>
      </div>

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
          <option value="5">5秒</option>
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
        <span class="cost-text">${{ costUSD }} / ¥{{ costCNY }}</span>
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

      <div v-if="previewVideoUrl" class="video-preview">
        <!-- 使用 key 强制视频在 URL 变化时重新加载 -->
        <video :key="previewVideoUrl" :src="previewVideoUrl" controls></video>
        <div v-if="data.ossUrl" class="oss-badge">☁️ 已存储到云端</div>
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
  left: 0;
  top: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  min-width: 320px;
  min-height: 200px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* 性能：把移动走合成层，减少重排 */
  will-change: transform;
  /* 性能：限制布局/绘制影响范围 */
  contain: layout paint;
  
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

.source-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  background: #e0f2fe;
  color: #0369a1;
}

.source-badge.comfly-premium {
  background: #fef3c7;
  color: #92400e;
}

.source-badge.comfly-original {
  background: #fce7f3;
  color: #9d174d;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.video-preview video {
  width: 100%;
  height: 100%;
  max-height: 300px;
  object-fit: contain;
}

.oss-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(16, 185, 129, 0.9);
  color: white;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
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