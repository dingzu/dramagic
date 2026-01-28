<script setup>
import { ref, onMounted, computed } from 'vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const props = defineProps({
  currentProject: {
    type: Object,
    default: null
  },
  creatingProject: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add-node', 'project-created', 'project-open', 'project-close', 'project-save', 'project-deleted'])

const canEditCanvas = computed(() => !!props.currentProject?.id)

const addTextNode = () => {
  if (!canEditCanvas.value) return
  emit('add-node', 'text')
}

const addVideoNode = () => {
  if (!canEditCanvas.value) return
  emit('add-node', 'video')
}

const loading = ref(false)
const error = ref('')
const projects = ref([])

const currentProjectId = computed(() => props.currentProject?.id ?? null)

const fetchProjects = async () => {
  loading.value = true
  error.value = ''
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects`)
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '获取项目列表失败')
    projects.value = data.data || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProjects()
})

const handleCreateProject = async () => {
  if (props.creatingProject) return
  const name = window.prompt('请输入项目名称', '未命名项目')
  if (name == null) return
  emit('project-created', { name })
  // 创建成功后由父组件保存并返回，再刷新列表
  // 这里先做一次延迟刷新，避免用户看不到新项目
  setTimeout(fetchProjects, 500)
}

const handleOpenProject = (p) => {
  emit('project-open', { id: p.id })
}

const handleCloseProject = () => {
  emit('project-close')
}

const handleSaveProject = () => {
  emit('project-save')
}

const handleDeleteProject = async (p, e) => {
  e?.stopPropagation?.()
  if (!p?.id) return
  const ok = window.confirm(`确认删除项目「${p.name}」？此操作不可恢复。`)
  if (!ok) return

  loading.value = true
  error.value = ''
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects/${encodeURIComponent(p.id)}`, {
      method: 'DELETE'
    })
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '删除失败')
    emit('project-deleted', { id: p.id })
    await fetchProjects()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>项目</h2>
    </div>

    <div class="project-panel">
      <div class="project-actions">
        <button class="action-btn primary" @click="handleCreateProject" :disabled="creatingProject">
          {{ creatingProject ? '创建中...' : '新建项目' }}
        </button>
        <button class="action-btn" @click="fetchProjects" :disabled="loading">刷新</button>
      </div>

      <div class="current-project">
        <div class="current-label">当前项目</div>
        <div class="current-name">
          {{ currentProject?.name || '（未打开）' }}
        </div>
        <div class="current-actions">
          <button class="action-btn" @click="handleSaveProject" :disabled="!currentProjectId">保存</button>
          <button class="action-btn danger" @click="handleCloseProject" :disabled="!currentProjectId">关闭</button>
        </div>
      </div>

      <div v-if="error" class="alert error">
        {{ error }}
      </div>

      <div class="project-list">
        <div class="list-title">项目列表</div>
        <div v-if="loading" class="muted">加载中...</div>
        <div v-else-if="projects.length === 0" class="muted">暂无项目</div>

        <div
          v-for="p in projects"
          :key="p.id"
          class="project-item"
          :class="{ active: currentProjectId === p.id }"
          @click="handleOpenProject(p)"
        >
          <div class="project-row">
            <div class="project-name">{{ p.name }}</div>
            <button class="delete-mini" title="删除" @click="handleDeleteProject(p, $event)">×</button>
          </div>
          <div class="project-meta">#{{ p.id }}</div>
        </div>
      </div>
    </div>
    
    <div class="node-list">
      <div class="node-title-row">
        <div class="node-section-title">节点库</div>
        <div v-if="!canEditCanvas" class="node-hint">先打开项目</div>
      </div>

      <div class="node-item" :class="{ disabled: !canEditCanvas }" @click="addTextNode">
        <div class="node-item-icon">📝</div>
        <div class="node-item-content">
          <div class="node-item-title">文本节点</div>
          <div class="node-item-desc">添加文本内容</div>
        </div>
      </div>
      
      <div class="node-item" :class="{ disabled: !canEditCanvas }" @click="addVideoNode">
        <div class="node-item-icon">🎬</div>
        <div class="node-item-content">
          <div class="node-item-title">Sora 2 视频</div>
          <div class="node-item-desc">AI 文生视频</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.sidebar-header h2 {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.project-panel {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.project-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.action-btn {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.action-btn.danger {
  color: #ef4444;
}

.action-btn.danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fecaca;
}

.current-project {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f8fafc;
  margin-bottom: 12px;
}

.current-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 6px;
}

.current-name {
  font-size: 14px;
  color: #111827;
  font-weight: 700;
  margin-bottom: 10px;
  word-break: break-word;
}

.current-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.alert {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  margin-bottom: 12px;
  border: 1px solid transparent;
}

.alert.error {
  background: #fef2f2;
  border-color: #fee2e2;
  color: #ef4444;
}

.project-list {
  margin-top: 8px;
}

.list-title {
  font-size: 12px;
  color: #64748b;
  font-weight: 800;
  margin-bottom: 8px;
}

.muted {
  font-size: 12px;
  color: #94a3b8;
}

.project-item {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 8px;
}

.project-item:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.project-item.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.08);
}

.project-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.delete-mini {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: #f1f5f9;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.delete-mini:hover {
  background: #fee2e2;
  color: #ef4444;
}

.project-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 2px;
}

.project-meta {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.node-list {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.node-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.node-section-title {
  font-size: 12px;
  color: #64748b;
  font-weight: 800;
}

.node-hint {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 12px;
  background: white;
}

.node-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.node-item.disabled:hover {
  border-color: #e5e7eb;
  background: white;
  transform: none;
  box-shadow: none;
}

.node-item:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.node-item-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.node-item-content {
  flex: 1;
}

.node-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.node-item-desc {
  font-size: 12px;
  color: #6b7280;
}
</style>
