<script setup>
import { ref, computed } from 'vue'
import TextNode from './TextNode.vue'
import VideoNode from './VideoNode.vue'
import Modal from './Modal.vue'

const emit = defineEmits(['changed', 'important-change'])

const props = defineProps({
  projectId: {
    type: [Number, String],
    default: null
  }
})

const nodes = ref([])
const nextNodeId = ref(1)
const selectedNodeId = ref(null)

// Modal 状态
const showModal = ref(false)
const modalTitle = ref('')
const modalContent = ref(null)

const openModal = (title, content) => {
  modalTitle.value = title
  modalContent.value = content
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  modalContent.value = null
}

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
      duration: 4,
      resultData: null // 存储原始 API 返回
    }
  }
  nodes.value.push(node)
  selectedNodeId.value = node.id
  emit('changed', getCanvasState())
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
    emit('changed', getCanvasState())
  }
}

// 更新节点位置（拖拽过程中，不触发同步广播）
const updateNodePosition = (id, x, y) => {
  const node = nodes.value.find(n => n.id === id)
  if (node) {
    node.x = x
    node.y = y
    // 拖拽过程中只更新本地，不触发 changed 事件（避免抖动）
  }
}

// 拖拽结束，触发同步广播
const handleDragEnd = (id) => {
  emit('changed', getCanvasState())
}

// 更新节点数据
const updateNodeData = (id, data) => {
  const node = nodes.value.find(n => n.id === id)
  if (node) {
    // 检测是否是"开始生成 Sora"的重要变更
    const isStartingSora = node.type === 'video' &&
      (node.data.status === 'idle' || node.data.status === 'failed' || node.data.status === 'completed') &&
      (data.status === 'creating' || data.status === 'queued')

    node.data = { ...node.data, ...data }
    const state = getCanvasState()
    emit('changed', state)

    // 重要变更：立即触发保存
    if (isStartingSora) {
      emit('important-change', state)
    }
  }
}

// 选择节点
const selectNode = (id) => {
  selectedNodeId.value = id
}

// 处理查看详情
const handleShowDetails = (data) => {
  openModal('API 响应详情', data)
}

function sanitizeNodeForSave(node) {
  const data = { ...(node.data || {}) }
  // 运行态字段不入库
  if ('pollTimer' in data) data.pollTimer = null
  return {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    data
  }
}

// 导出画布状态（可持久化）
const getCanvasState = () => {
  return {
    version: 1,
    nextNodeId: nextNodeId.value,
    nodes: nodes.value.map(sanitizeNodeForSave)
  }
}

// 加载画布状态
const loadCanvasState = (state) => {
  const incomingNodes = Array.isArray(state?.nodes) ? state.nodes : []
  nodes.value = incomingNodes.map((n) => ({
    id: Number(n.id),
    type: n.type,
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    data: { ...(n.data || {}) }
  }))

  const maxId = nodes.value.reduce((m, n) => (Number.isFinite(n.id) ? Math.max(m, n.id) : m), 0)
  nextNodeId.value = Number(state?.nextNodeId) || (maxId + 1)
  selectedNodeId.value = null
  emit('changed', getCanvasState())
}

const clearCanvas = () => {
  // 清理旧节点的定时器
  for (const n of nodes.value) {
    if (n?.data?.pollTimer) clearInterval(n.data.pollTimer)
  }
  nodes.value = []
  nextNodeId.value = 1
  selectedNodeId.value = null
  emit('changed', getCanvasState())
}

// 暴露方法给父组件
defineExpose({
  addNode,
  getCanvasState,
  loadCanvasState,
  clearCanvas
})
</script>

<template>
  <div class="canvas" @click="selectedNodeId = null">
    <div v-if="nodes.length === 0" class="empty-state">
      <div class="empty-icon">✨</div>
      <div class="empty-text">从左侧添加节点开始创作</div>
    </div>
    
    <component
      v-for="node in nodes"
      :key="`${props.projectId ?? 'no-project'}-${node.id}`"
      :is="node.type === 'text' ? TextNode : VideoNode"
      :id="node.id"
      :x="node.x"
      :y="node.y"
      :data="node.data"
      :selected="selectedNodeId === node.id"
      :project-id="props.projectId"
      @update:position="updateNodePosition"
      @update:data="updateNodeData"
      @select="selectNode"
      @delete="deleteNode"
      @show-details="handleShowDetails"
      @drag-end="handleDragEnd"
      @click.stop
    />

    <Modal 
      :show="showModal" 
      :title="modalTitle" 
      :content="modalContent" 
      @close="closeModal" 
    />
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #f8fafc;
  /* 硅谷风格点阵背景 */
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 24px 24px;
  overflow: hidden;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #64748b;
  pointer-events: none;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.8;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
</style>
