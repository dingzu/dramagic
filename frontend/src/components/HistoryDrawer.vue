<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  show: Boolean,
  projectId: [Number, String]
})

const emit = defineEmits(['close'])

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const tasks = ref([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20

// 加载任务列表
const loadTasks = async () => {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize
    let url = `${apiBaseUrl}/api/v1/video-tasks?limit=${pageSize}&offset=${offset}`
    
    // 如果有 projectId，按项目筛选
    if (props.projectId) {
      url += `&project_id=${props.projectId}`
    }

    const resp = await fetch(url)
    const data = await resp.json()

    if (data.success) {
      tasks.value = data.data.tasks || []
      total.value = data.data.total || 0
    } else {
      console.error('加载任务列表失败:', data.error)
    }
  } catch (err) {
    console.error('加载任务列表失败:', err.message)
  } finally {
    loading.value = false
  }
}

// 刷新列表
const refresh = () => {
  currentPage.value = 1
  loadTasks()
}

// 监听抽屉打开
watch(() => props.show, (newVal) => {
  if (newVal) {
    refresh()
  }
})

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化来源
const formatSource = (source) => {
  if (source === 'comfly-premium') return 'Comfly 官方'
  if (source === 'comfly-original') return 'Comfly Original'
  if (source === 'fal') return 'fal.ai'
  return source || '-'
}

// 获取状态样式
const getStatusClass = (status) => {
  switch (status) {
    case 'completed': return 'status-completed'
    case 'failed': return 'status-failed'
    case 'pending':
    case 'in_progress': return 'status-pending'
    default: return ''
  }
}

// 获取状态文本
const getStatusText = (status) => {
  switch (status) {
    case 'completed': return '已完成'
    case 'failed': return '失败'
    case 'pending': return '处理中'
    case 'in_progress': return '生成中'
    default: return status || '-'
  }
}

// 获取视频 URL（优先 OSS URL，然后源 URL）
const getVideoUrl = (task) => {
  // 优先使用 OSS URL
  if (task.oss_url) {
    return task.oss_url
  }
  // 其次使用源平台 URL
  return task.source_video_url
}

// 复制链接
const copyUrl = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
    alert('链接已复制')
  } catch {
    alert('复制失败')
  }
}

// 下一页
const nextPage = () => {
  if (currentPage.value * pageSize < total.value) {
    currentPage.value++
    loadTasks()
  }
}

// 上一页
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTasks()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="show" class="drawer-overlay" @click="emit('close')">
        <div class="drawer" @click.stop>
          <div class="drawer-header">
            <h3>历史任务</h3>
            <button class="refresh-btn" @click="refresh" :disabled="loading">
              {{ loading ? '加载中...' : '刷新' }}
            </button>
            <button class="close-btn" @click="emit('close')">×</button>
          </div>

          <div class="drawer-content">
            <div v-if="loading && tasks.length === 0" class="loading">
              加载中...
            </div>

            <div v-else-if="tasks.length === 0" class="empty">
              暂无历史任务
            </div>

            <div v-else class="task-list">
              <div v-for="task in tasks" :key="task.id" class="task-item">
                <div class="task-header">
                  <span class="task-time">{{ formatTime(task.created_at) }}</span>
                  <span class="task-source">{{ formatSource(task.source) }}</span>
                  <span class="task-status" :class="getStatusClass(task.status)">
                    {{ getStatusText(task.status) }}
                  </span>
                </div>

                <div class="task-prompt">{{ task.prompt }}</div>

                <div class="task-meta">
                  <span class="task-duration">{{ task.duration }}秒</span>
                  <span v-if="task.cost_cny" class="task-cost">¥{{ Number(task.cost_cny).toFixed(2) }}</span>
                  <span v-if="task.oss_url" class="task-oss-badge">已存储</span>
                </div>

                <div v-if="getVideoUrl(task)" class="task-video">
                  <video :src="getVideoUrl(task)" controls preload="metadata"></video>
                  <div class="video-actions">
                    <a :href="getVideoUrl(task)" target="_blank" class="video-link">打开</a>
                    <button class="copy-btn" @click="copyUrl(getVideoUrl(task))">复制链接</button>
                  </div>
                </div>

                <div v-if="task.error" class="task-error">
                  {{ task.error }}
                </div>
              </div>
            </div>

            <div v-if="total > pageSize" class="pagination">
              <button @click="prevPage" :disabled="currentPage === 1">上一页</button>
              <span class="page-info">{{ currentPage }} / {{ Math.ceil(total / pageSize) }}</span>
              <button @click="nextPage" :disabled="currentPage * pageSize >= total">下一页</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: 420px;
  max-width: 90vw;
  height: 100%;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.drawer-header h3 {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.refresh-btn {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  margin-right: 12px;
}

.refresh-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 18px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading, .empty {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 14px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-item {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.task-time {
  font-size: 12px;
  color: #6b7280;
}

.task-source {
  font-size: 11px;
  padding: 2px 6px;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 4px;
}

.task-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.status-completed {
  background: #dcfce7;
  color: #15803d;
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-pending {
  background: #fef3c7;
  color: #b45309;
}

.task-prompt {
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 10px;
}

.task-cost {
  color: #059669;
  font-weight: 600;
}

.task-oss-badge {
  padding: 2px 6px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 4px;
  font-size: 11px;
}

.task-video {
  margin-top: 10px;
}

.task-video video {
  width: 100%;
  border-radius: 8px;
  background: #0f172a;
  max-height: 200px;
}

.video-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.video-link, .copy-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}

.video-link {
  background: #3b82f6;
  color: white;
}

.video-link:hover {
  background: #2563eb;
}

.copy-btn {
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.copy-btn:hover {
  background: #f3f4f6;
}

.task-error {
  margin-top: 10px;
  padding: 8px 10px;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  font-size: 12px;
  color: #dc2626;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.pagination button {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: #f3f4f6;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #6b7280;
}

/* 动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  background: rgba(0, 0, 0, 0);
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(100%);
}
</style>
