<script setup>
const emit = defineEmits(['add-node'])

const addTextNode = () => {
  emit('add-node', 'text')
}

const addVideoNode = () => {
  emit('add-node', 'video')
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>节点库</h2>
    </div>
    
    <div class="node-list">
      <div class="node-item" @click="addTextNode">
        <div class="node-item-icon">📝</div>
        <div class="node-item-content">
          <div class="node-item-title">文本节点</div>
          <div class="node-item-desc">添加文本内容</div>
        </div>
      </div>
      
      <div class="node-item" @click="addVideoNode">
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

.node-list {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
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
