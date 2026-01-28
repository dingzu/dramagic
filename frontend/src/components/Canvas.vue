<script setup>
import { ref, computed } from 'vue'
import TextNode from './TextNode.vue'
import VideoNode from './VideoNode.vue'

const nodes = ref([])
const nextNodeId = ref(1)
const selectedNodeId = ref(null)

// 添加节点
const addNode = (type) => {
  const node = {
    id: nextNodeId.value++,
    type,
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 200,
    data: type === 'text' ? { text: '输入文本...' } : { 
      prompt: '', 
      status: 'idle',
      videoUrl: null,
      requestId: null,
      pollTimer: null,
      startTime: null,
      cost: 0,
      duration: 4
    }
  }
  nodes.value.push(node)
  selectedNodeId.value = node.id
}

// 删除节点
const deleteNode = (id) => {
  const index = nodes.value.findIndex(n => n.id === id)
  if (index !== -1) {
    // 清理定时器
    const node = nodes.value[index]
    if (node.data.pollTimer) {
      clearInterval(node.data.pollTimer)
    }
    nodes.value.splice(index, 1)
    if (selectedNodeId.value === id) {
      selectedNodeId.value = null
    }
  }
}

// 更新节点位置
const updateNodePosition = (id, x, y) => {
  const node = nodes.value.find(n => n.id === id)
  if (node) {
    node.x = x
    node.y = y
  }
}

// 更新节点数据
const updateNodeData = (id, data) => {
  const node = nodes.value.find(n => n.id === id)
  if (node) {
    node.data = { ...node.data, ...data }
  }
}

// 选择节点
const selectNode = (id) => {
  selectedNodeId.value = id
}

// 暴露方法给父组件
defineExpose({
  addNode
})
</script>

<template>
  <div class="canvas" @click="selectedNodeId = null">
    <div v-if="nodes.length === 0" class="empty-state">
      <div class="empty-icon">📝</div>
      <div class="empty-text">从左侧添加节点开始创作</div>
    </div>
    
    <component
      v-for="node in nodes"
      :key="node.id"
      :is="node.type === 'text' ? TextNode : VideoNode"
      :id="node.id"
      :x="node.x"
      :y="node.y"
      :data="node.data"
      :selected="selectedNodeId === node.id"
      @update:position="updateNodePosition"
      @update:data="updateNodeData"
      @select="selectNode"
      @delete="deleteNode"
      @click.stop
    />
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: #ffffff;
  background-image: 
    linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: hidden;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #999;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 18px;
  font-weight: 500;
}
</style>
