<script setup>
import { ref } from 'vue'

const emit = defineEmits(['login-success'])

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const handleSubmit = async () => {
  if (!password.value.trim()) {
    errorMessage.value = '请输入密码'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: password.value
      })
    })

    const data = await resp.json()

    if (!resp.ok || !data.success) {
      throw new Error(data.error || '密码验证失败')
    }

    // 保存登录状态到 localStorage
    localStorage.setItem('dramagic_authenticated', 'true')
    
    // 触发登录成功事件
    emit('login-success')
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}

const handleKeyPress = (e) => {
  if (e.key === 'Enter') {
    handleSubmit()
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo">
        <span class="logo-icon">✨</span>
        <h1 class="logo-text">Dramagic</h1>
      </div>
      
      <p class="subtitle">AI 视频生成平台</p>
      
      <div class="login-form">
        <div class="form-group">
          <label for="password">访问密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入访问密码"
            @keypress="handleKeyPress"
            :disabled="loading"
            autofocus
          />
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <button 
          class="login-btn"
          @click="handleSubmit"
          :disabled="loading"
        >
          {{ loading ? '验证中...' : '进入' }}
        </button>
      </div>
      
      <div class="footer">
        <p class="hint">💡 请输入正确的访问密码以使用本平台</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.logo-icon {
  font-size: 48px;
}

.logo-text {
  font-size: 36px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.subtitle {
  text-align: center;
  color: #6b7280;
  font-size: 16px;
  margin: 0 0 32px 0;
}

.login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.2s;
  outline: none;
}

.form-group input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.error-message {
  padding: 12px 16px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
  margin-bottom: 20px;
  animation: shake 0.4s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.footer {
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.6;
}
</style>
