<script setup>
import { ref, onMounted } from 'vue'
import Login from './components/Login.vue'
import Sidebar from './components/Sidebar.vue'
import Canvas from './components/Canvas.vue'
import Playground from './components/Playground.vue'

const isAuthenticated = ref(false)
const activeTab = ref('canvas')
const canvasRef = ref(null)

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
  if (canvasRef.value) {
    canvasRef.value.addNode(type)
  }
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
        <Sidebar @add-node="handleAddNode" />
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
