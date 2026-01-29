<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { io } from 'socket.io-client'
import Login from './components/Login.vue'
import Sidebar from './components/Sidebar.vue'
import Canvas from './components/Canvas.vue'
import Playground from './components/Playground.vue'
import HistoryDrawer from './components/HistoryDrawer.vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const isAuthenticated = ref(false)
const activeTab = ref('canvas')
const canvasRef = ref(null)
const currentProject = ref(null)
const creatingProject = ref(false)
const onlineUsers = ref(0)
const showHistoryDrawer = ref(false)

let autosaveTimer = null
let backendSaveTimer = null
let dirtyProjectId = null
let pendingSaveProjectId = null
let pendingSaveState = null
let socket = null
let ignoreNextRemoteUpdate = false

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

const scheduleBackendSave = (projectId, canvasState) => {
  if (!projectId) return

  // 绑定 projectId 的防抖，避免跨项目写入
  pendingSaveProjectId = projectId
  pendingSaveState = canvasState

  if (backendSaveTimer) clearTimeout(backendSaveTimer)
  backendSaveTimer = setTimeout(() => {
    if (!pendingSaveProjectId) return
    // 关键：只保存触发该定时器的项目
    const pid = pendingSaveProjectId
    const st = pendingSaveState
    pendingSaveProjectId = null
    pendingSaveState = null
    saveProjectById(pid, st, { silent: true })
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
    dirtyProjectId = null
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
    dirtyProjectId = null
  } catch (e) {
    window.alert(e.message)
  }
}

const saveProjectById = async (projectId, canvasState, { silent = false } = {}) => {
  if (!projectId) return
  try {
    const canvas_state = canvasState ?? canvasRef.value?.getCanvasState?.()
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canvas_state })
    })
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '保存失败')
    dirtyProjectId = null
    writeLocalCache(projectId, canvas_state)
    if (!silent) window.alert('保存成功')
  } catch (e) {
    if (!silent) window.alert(e.message)
  }
}

const handleProjectSave = async ({ silent = false } = {}) => {
  const pid = currentProject.value?.id
  if (!pid) return
  const canvas_state = canvasRef.value?.getCanvasState?.()
  await saveProjectById(pid, canvas_state, { silent })
}

const handleProjectClose = () => {
  currentProject.value = null
  // 切项目/关闭时，取消未触发的后端保存，避免跨项目写入
  if (backendSaveTimer) clearTimeout(backendSaveTimer)
  backendSaveTimer = null
  pendingSaveProjectId = null
  pendingSaveState = null
  try {
    localStorage.removeItem(activeProjectStorageKey())
  } catch {
    // ignore
  }
  canvasRef.value?.clearCanvas?.()
  dirtyProjectId = null
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

// 记录本地最后更新时间戳，用于冲突检测
let localLastUpdateTs = 0

const handleCanvasChanged = (state, { fromRemote = false } = {}) => {
  const pid = currentProject.value?.id
  if (!pid) return

  // 如果是远程更新触发的 changed 事件，忽略
  if (ignoreNextRemoteUpdate) return

  const ts = Date.now()
  localLastUpdateTs = ts
  dirtyProjectId = pid
  writeLocalCache(pid, state)
  scheduleBackendSave(pid, state)

  // 广播给同项目的其他用户（带时间戳）
  if (!fromRemote && socket && socket.connected) {
    socket.emit('canvas-update', { projectId: pid, state, timestamp: ts })
  }
}

// 重要变更：立即保存（如生成 Sora）
const handleImportantChange = (state) => {
  const pid = currentProject.value?.id
  if (!pid) return

  // 取消防抖定时器，立即保存
  if (backendSaveTimer) clearTimeout(backendSaveTimer)
  backendSaveTimer = null
  pendingSaveProjectId = null
  pendingSaveState = null

  const ts = Date.now()
  localLastUpdateTs = ts
  writeLocalCache(pid, state)
  saveProjectById(pid, state, { silent: true })

  // 广播（带时间戳）
  if (socket && socket.connected) {
    socket.emit('canvas-update', { projectId: pid, state, timestamp: ts })
  }
}

// Socket.IO 连接管理
const connectSocket = () => {
  if (socket) return

  socket = io(apiBaseUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: true
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
    // 如果已有打开的项目，加入房间
    if (currentProject.value?.id) {
      socket.emit('join-project', { projectId: currentProject.value.id })
    }
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected')
    onlineUsers.value = 0
  })

  socket.on('online-users', ({ count }) => {
    onlineUsers.value = count
  })

  socket.on('canvas-update', ({ projectId, state, timestamp }) => {
    // 只处理当前项目的更新
    if (projectId !== currentProject.value?.id) return

    // 时间戳冲突检测：如果远程更新比本地最后更新更旧，忽略
    // 允许 500ms 的容差（网络延迟）
    if (timestamp && localLastUpdateTs && timestamp < localLastUpdateTs - 500) {
      console.log('Ignoring stale remote update:', timestamp, 'vs local:', localLastUpdateTs)
      return
    }

    // 防止自己广播的更新再次触发
    ignoreNextRemoteUpdate = true
    canvasRef.value?.loadCanvasState?.(state)
    writeLocalCache(projectId, state)
    // loadCanvasState 会触发 changed 事件，需要忽略
    setTimeout(() => {
      ignoreNextRemoteUpdate = false
    }, 100)
  })
}

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  onlineUsers.value = 0
}

// 加入/离开项目房间
const joinProjectRoom = (projectId) => {
  if (socket && socket.connected && projectId) {
    socket.emit('join-project', { projectId })
  }
}

const leaveProjectRoom = (projectId) => {
  if (socket && socket.connected && projectId) {
    socket.emit('leave-project', { projectId })
  }
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

  // 连接 Socket.IO
  connectSocket()
})

onUnmounted(() => {
  if (autosaveTimer) clearInterval(autosaveTimer)
  if (backendSaveTimer) clearTimeout(backendSaveTimer)
  disconnectSocket()
})

// 监听项目切换，自动加入/离开房间
watch(currentProject, (newVal, oldVal) => {
  if (oldVal?.id) {
    leaveProjectRoom(oldVal.id)
  }
  if (newVal?.id) {
    joinProjectRoom(newVal.id)
  }
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
          class="nav-item history-btn"
          @click="showHistoryDrawer = true"
        >
          📋 历史
        </button>
        <div v-if="onlineUsers > 0 && currentProject?.id" class="online-users">
          <span class="online-dot"></span>
          <span class="online-count">{{ onlineUsers }} 人在线</span>
        </div>
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
          @important-change="handleImportantChange"
        />
      </template>
      <Playground v-else />
    </div>

    <!-- 历史任务抽屉 -->
    <HistoryDrawer 
      :show="showHistoryDrawer"
      :project-id="currentProject?.id"
      @close="showHistoryDrawer = false"
    />
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

.nav-item.history-btn {
  color: #6366f1;
}

.nav-item.history-btn:hover {
  background: #eef2ff;
  color: #4f46e5;
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

.online-users {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 20px;
  margin-right: 8px;
}

.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.online-count {
  font-size: 13px;
  font-weight: 600;
  color: #059669;
}
</style>
