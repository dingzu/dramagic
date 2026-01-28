<script setup>
import { ref, onMounted } from 'vue'
import Login from './components/Login.vue'
import Sidebar from './components/Sidebar.vue'
import Canvas from './components/Canvas.vue'
import Playground from './components/Playground.vue'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const isAuthenticated = ref(false)
const activeTab = ref('canvas')
const canvasRef = ref(null)
const currentProject = ref(null)

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
    window.alert('项目创建成功')
  } catch (e) {
    window.alert(e.message)
  }
}

const handleProjectOpen = async ({ id }) => {
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/projects/${encodeURIComponent(id)}`)
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error || data.message || '打开项目失败')
    currentProject.value = { id: data.data.id, name: data.data.name }
    canvasRef.value?.loadCanvasState?.(data.data.canvas_state)
  } catch (e) {
    window.alert(e.message)
  }
}

const handleProjectSave = async () => {
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
    window.alert('保存成功')
  } catch (e) {
    window.alert(e.message)
  }
}

const handleProjectClose = () => {
  currentProject.value = null
  canvasRef.value?.clearCanvas?.()
}
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
          @add-node="handleAddNode"
          @project-created="handleProjectCreated"
          @project-open="handleProjectOpen"
          @project-save="handleProjectSave"
          @project-close="handleProjectClose"
        />
        <Canvas ref="canvasRef" />
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
