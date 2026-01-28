<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Login from './components/Login.vue'
import Sidebar from './components/Sidebar.vue'
import Canvas from './components/Canvas.vue'
import Playground from './components/Playground.vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const isAuthenticated = ref(false)
const activeTab = ref('canvas')
const canvasRef = ref(null)
const currentProject = ref(null)
const creatingProject = ref(false)

let autosaveTimer = null
let backendSaveTimer = null
let dirty = false

const activeProjectStorageKey = () => `dramagic_active_project_id`
const projectCanvasStorageKey = (id) => `dramagic_project_${id}_canvas_state`
const projectLocalUpdatedAtKey = (id) => `dramagic_project_${id}_local_updated_at`

const writeLocalCache = (projectId, canvasState) => {
  if (!projectId) return
  try {
    localStorage.setItem(projectCanvasStorageKey(projectId), JSON.stringify(canvasState || {}))
    localStorage.setItem(projectLocalUpdatedAtKey(projectId), String(Date.now()))
  } catch {
    // ignore
  }
}

const scheduleBackendSave = () => {
  if (!currentProject.value?.id) return
  if (!dirty) return

  if (backendSaveTimer) clearTimeout(backendSaveTimer)
  backendSaveTimer = setTimeout(() => {
    handleProjectSave({ silent: true })
  }, 2000)
}

// 检查登录状态
onMounted(() => {
  const authenticated = localStorage.getItem('dramagic_authenticated')
  isAuthenticated.value = authenticated === 'true'
})

const handleLoginSuccess = () => {
  isAuthenticated.value = true
}

const handleLogout = () => {
  localStorage.removeItem('dramagic_authenticated')
  isAuthenticated.value = false
}

const handleAddNode = (type) => {
  if (!currentProject.value?.id) {
    window.alert('请先新建或打开一个项目，再添加节点')
    return
  }
  canvasRef.value?.addNode?.(type)
}

const handleProjectCreated = async ({ name }) => {
  try {
    creatingProject.value = true
    // 新建项目：强制空白画布
    const canvas_state = { version: 1, nodes: [], nextNodeId: 1 }
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, canvas_state })
    })
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '创建项目失败')
    currentProject.value = data.data
    // 进入该项目后，画布应为空白
    canvasRef.value?.loadCanvasState?.(canvas_state)
    localStorage.setItem(activeProjectStorageKey(), String(data.data.id))
    writeLocalCache(data.data.id, canvas_state)
    dirty = false
    window.alert('项目创建成功')
  } catch (e) {
    window.alert(e.message)
  } finally {
    creatingProject.value = false
  }
}

const handleProjectOpen = async ({ id }) => {
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects/${encodeURIComponent(id)}`)
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '打开项目失败')
    const serverUpdatedAt = data.data.updated_at ? Date.parse(data.data.updated_at) : 0
    const localUpdatedAt = Number(localStorage.getItem(projectLocalUpdatedAtKey(data.data.id)) || 0)
    const localCanvasRaw = localStorage.getItem(projectCanvasStorageKey(data.data.id))
    const localCanvas = localCanvasRaw ? JSON.parse(localCanvasRaw) : null

    currentProject.value = { id: data.data.id, name: data.data.name }
    localStorage.setItem(activeProjectStorageKey(), String(data.data.id))

    // 本地缓存更“新”则优先本地（防止丢失未上传的改动）
    const stateToLoad = localCanvas && localUpdatedAt > serverUpdatedAt ? localCanvas : data.data.canvas_state
    canvasRef.value?.loadCanvasState?.(stateToLoad)
    writeLocalCache(data.data.id, stateToLoad)
    dirty = false
  } catch (e) {
    window.alert(e.message)
  }
}

const handleProjectSave = async ({ silent = false } = {}) => {
  if (!currentProject.value?.id) return
  try {
    const canvas_state = canvasRef.value?.getCanvasState?.()
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects/${encodeURIComponent(currentProject.value.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canvas_state })
    })
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '保存失败')
    dirty = false
    writeLocalCache(currentProject.value.id, canvas_state)
    if (!silent) window.alert('保存成功')
  } catch (e) {
    if (!silent) window.alert(e.message)
  }
}

const handleProjectClose = () => {
  currentProject.value = null
  try {
    localStorage.removeItem(activeProjectStorageKey())
  } catch {
    // ignore
  }
  canvasRef.value?.clearCanvas?.()
  dirty = false
}

const handleProjectDeleted = ({ id }) => {
  if (currentProject.value?.id === id) {
    handleProjectClose()
  }
  try {
    localStorage.removeItem(projectCanvasStorageKey(id))
    localStorage.removeItem(projectLocalUpdatedAtKey(id))
  } catch {
    // ignore
  }
}

const handleCanvasChanged = (state) => {
  if (!currentProject.value?.id) return
  dirty = true
  writeLocalCache(currentProject.value.id, state)
  scheduleBackendSave()
}

onMounted(() => {
  // 自动保存：本地更频繁（10s），后端由 changed 触发防抖
  autosaveTimer = setInterval(() => {
    if (!currentProject.value?.id) return
    const state = canvasRef.value?.getCanvasState?.()
    if (!state) return
    writeLocalCache(currentProject.value.id, state)
  }, 10000)

  // 自动恢复“上次打开项目”（优先本地缓存，避免丢失）
  const lastId = localStorage.getItem(activeProjectStorageKey())
  if (lastId) {
    handleProjectOpen({ id: lastId })
  }
})

onUnmounted(() => {
  if (autosaveTimer) clearInterval(autosaveTimer)
  if (backendSaveTimer) clearTimeout(backendSaveTimer)
})
</script>

<template>
  <!-- 登录页面 -->
  <Login v-if="!isAuthenticated" @login-success="handleLoginSuccess" />
  
  <!-- 主应用 -->
  <div v-else class="app">
    <div class="header">
      <div class="logo">
        <span class="logo-icon">✨</span>
        <span class="logo-text">Dramagic</span>
      </div>
      <nav class="nav">
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'canvas' }"
          @click="activeTab = 'canvas'"
        >
          画布
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'playground' }"
          @click="activeTab = 'playground'"
        >
          Playground
        </button>
        <button 
          class="nav-item logout-btn"
          @click="handleLogout"
        >
          退出
        </button>
      </nav>
    </div>
    
    <div class="main">
      <template v-if="activeTab === 'canvas'">
        <Sidebar
          :current-project="currentProject"
          :creating-project="creatingProject"
          @add-node="handleAddNode"
          @project-created="handleProjectCreated"
          @project-open="handleProjectOpen"
          @project-save="handleProjectSave"
          @project-close="handleProjectClose"
          @project-deleted="handleProjectDeleted"
        />
        <Canvas
          ref="canvasRef"
          :project-id="currentProject?.id ?? 'no-project'"
          @changed="handleCanvasChanged"
        />
      </template>
      <Playground v-else />
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: white;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

.nav {
  display: flex;
  gap: 8px;
}

.nav-item {
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #f3f4f6;
  color: #111827;
}

.nav-item.active {
  background: #3b82f6;
  color: white;
}

.nav-item.logout-btn {
  color: #ef4444;
}

.nav-item.logout-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
