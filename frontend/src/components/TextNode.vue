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
      // 使用 requestAnimationFrame 优化性能
      requestAnimationFrame(() => {
        emit('update:position', props.id, e.clientX - dragStart.value.x, e.clientY - dragStart.value.y)
      })
    }
  }
  
  const onMouseUp = () => {
    isDragging.value = false
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
    :style="{ left: x + 'px', top: y + 'px' }"
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
        rows="4"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.node {
  position: absolute;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  min-width: 280px;
  cursor: move;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.node.dragging {
  transition: none;
  opacity: 0.9;
}

.node.selected {
  border-color: #3b82f6;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 10px 10px 0 0;
  user-select: none;
}

.node-icon {
  font-size: 18px;
}

.node-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.delete-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.node-content {
  padding: 16px;
}

textarea {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}

textarea:focus {
  border-color: #3b82f6;
}

textarea::placeholder {
  color: #9ca3af;
}
</style>
