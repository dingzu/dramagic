<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  id: Number,
  x: Number,
  y: Number,
  data: Object,
  selected: Boolean
})

const emit = defineEmits(['update:position', 'update:data', 'select', 'delete'])

const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

// 拖拽性能：每帧最多触发一次位置更新
let dragRafId = null
let pendingPos = null

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
    pendingPos = null
    if (dragRafId != null) {
      cancelAnimationFrame(dragRafId)
      dragRafId = null
    }
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const updateText = (e) => {
  emit('update:data', props.id, { text: e.target.value })
}

const handleDelete = () => {
  emit('delete', props.id)
}
</script>

<template>
  <div 
    class="node text-node"
    :class="{ selected, dragging: isDragging }"
    :style="{ transform: `translate3d(${x}px, ${y}px, 0)` }"
  >
    <div class="node-header" @mousedown="startDrag">
      <span class="node-icon">📝</span>
      <span class="node-title">文本节点</span>
      <button class="delete-btn" @click.stop="handleDelete">×</button>
    </div>
    <div class="node-content">
      <textarea 
        :value="data.text" 
        @input="updateText"
        @click.stop
        placeholder="输入文本..."
      ></textarea>
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
  min-width: 280px;
  min-height: 160px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
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
  display: flex;
  flex-direction: column;
  background: white;
}

textarea {
  width: 100%;
  flex: 1;
  border: none;
  padding: 0;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  background: transparent;
  color: #334155;
  line-height: 1.5;
}

textarea::placeholder {
  color: #94a3b8;
}
</style>
