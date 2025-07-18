<template>
  <n-modal
    v-model:show="showModal"
    preset="dialog"
    title="修改密码"
    :mask-closable="false"
    :closable="false"
    style="width: 500px"
  >
    <div class="password-change-modal">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-placement="top"
        size="medium"
      >
        <!-- 当前密码 -->
        <n-form-item path="currentPassword" label="当前密码">
          <n-input
            v-model:value="formData.currentPassword"
            type="password"
            placeholder="请输入当前密码"
            show-password-on="click"
            :input-props="{ autocomplete: 'current-password' }"
            @input="clearErrors"
          >
            <template #prefix>
              <n-icon :component="LockClosedOutline" />
            </template>
          </n-input>
        </n-form-item>

        <!-- 新密码 -->
        <n-form-item path="newPassword" label="新密码">
          <n-input
            v-model:value="formData.newPassword"
            type="password"
            placeholder="请输入新密码（至少8位）"
            show-password-on="click"
            :input-props="{ autocomplete: 'new-password' }"
            @input="onNewPasswordInput"
          >
            <template #prefix>
              <n-icon :component="KeyOutline" />
            </template>
            <template #suffix>
              <n-button
                text
                size="small"
                @click="generateSecurePassword"
                :disabled="loading"
              >
                <template #icon>
                  <n-icon :component="RefreshOutline" />
                </template>
              </n-button>
            </template>
          </n-input>
          
          <!-- 密码强度指示器 -->
          <div v-if="passwordStrength" class="password-strength mt-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-600">密码强度:</span>
              <span 
                class="text-sm font-medium"
                :class="strengthTextClass"
              >
                {{ strengthText }}
              </span>
            </div>
            
            <!-- 强度条 -->
            <div class="strength-bar flex gap-1 mb-2">
              <div 
                v-for="i in 5" 
                :key="i"
                class="flex-1 h-2 rounded-sm transition-colors duration-200"
                :class="getStrengthBarClass(i)"
              ></div>
            </div>
            
            <!-- 密码要求检查 -->
            <div class="password-requirements text-xs space-y-1">
              <div 
                v-for="requirement in passwordRequirements"
                :key="requirement.key"
                class="flex items-center gap-2"
                :class="requirement.met ? 'text-green-600' : 'text-gray-500'"
              >
                <n-icon 
                  :component="requirement.met ? CheckmarkCircleOutline : CloseCircleOutline"
                  :class="requirement.met ? 'text-green-500' : 'text-gray-400'"
                />
                <span>{{ requirement.text }}</span>
              </div>
            </div>
            
            <!-- 密码建议 -->
            <div v-if="passwordStrength.feedback.length > 0" class="password-feedback mt-2">
              <div class="text-xs text-orange-600 space-y-1">
                <div v-for="(tip, index) in passwordStrength.feedback" :key="index" class="flex items-start gap-1">
                  <n-icon :component="InformationCircleOutline" class="text-orange-500 mt-0.5 flex-shrink-0" size="12" />
                  <span>{{ tip }}</span>
                </div>
              </div>
            </div>
          </div>
        </n-form-item>

        <!-- 确认新密码 -->
        <n-form-item path="confirmPassword" label="确认新密码">
          <n-input
            v-model:value="formData.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password-on="click"
            :input-props="{ autocomplete: 'new-password' }"
            @input="clearErrors"
          >
            <template #prefix>
              <n-icon :component="KeyOutline" />
            </template>
            <template #suffix>
              <n-icon 
                v-if="formData.confirmPassword && formData.newPassword"
                :component="formData.confirmPassword === formData.newPassword ? CheckmarkCircleOutline : CloseCircleOutline"
                :class="formData.confirmPassword === formData.newPassword ? 'text-green-500' : 'text-red-500'"
              />
            </template>
          </n-input>
        </n-form-item>
      </n-form>
      
      <!-- 安全提示 -->
      <n-alert type="info" class="mt-4" :show-icon="false">
        <template #icon>
          <n-icon :component="ShieldCheckmarkOutline" />
        </template>
        <div class="text-sm">
          <div class="font-medium mb-1">安全提示:</div>
          <ul class="text-xs space-y-1 text-gray-600">
            <li>• 密码将使用高强度加密算法保护</li>
            <li>• 建议使用包含大小写字母、数字和特殊字符的密码</li>
            <li>• 避免使用个人信息或常见词汇作为密码</li>
          </ul>
        </div>
      </n-alert>
    </div>
    
    <template #action>
      <div class="flex justify-end gap-3">
        <n-button @click="handleCancel" :disabled="loading">
          取消
        </n-button>
        <n-button 
          type="primary" 
          @click="handleConfirm" 
          :loading="loading"
          :disabled="!isFormValid"
        >
          确认修改
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NIcon,
  NAlert,
  useMessage
} from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import {
  LockClosedOutline,
  KeyOutline,
  RefreshOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  InformationCircleOutline,
  ShieldCheckmarkOutline
} from '@vicons/ionicons5'
import { encodePassword, addSecurityHeaders } from '@/utils/crypto'
import { 
  checkPasswordStrength, 
  generatePasswordSuggestion, 
  calculatePasswordSimilarity, 
  type PasswordStrength 
} from '@/utils/passwordValidator'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const message = useMessage()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const passwordStrength = ref<PasswordStrength | null>(null)

const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const formData = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 密码要求检查
const passwordRequirements = computed(() => {
  const password = formData.newPassword
  return [
    {
      key: 'length',
      text: '至少8个字符',
      met: password.length >= 8
    },
    {
      key: 'lowercase',
      text: '包含小写字母',
      met: /[a-z]/.test(password)
    },
    {
      key: 'uppercase',
      text: '包含大写字母',
      met: /[A-Z]/.test(password)
    },
    {
      key: 'number',
      text: '包含数字',
      met: /\d/.test(password)
    },
    {
      key: 'special',
      text: '包含特殊字符',
      met: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  ]
})

// 密码强度文本
const strengthText = computed(() => {
  if (!passwordStrength.value) return ''
  const level = passwordStrength.value.level
  const textMap = {
    'weak': '弱',
    'fair': '一般', 
    'good': '良好',
    'strong': '强',
    'very-strong': '很强'
  }
  return textMap[level] || ''
})

// 密码强度文本样式
const strengthTextClass = computed(() => {
  if (!passwordStrength.value) return ''
  const level = passwordStrength.value.level
  return {
    'text-red-600': level === 'weak',
    'text-orange-600': level === 'fair',
    'text-yellow-600': level === 'good',
    'text-green-600': level === 'strong' || level === 'very-strong'
  }
})

// 强度条样式
const getStrengthBarClass = (index: number) => {
  if (!passwordStrength.value) return 'bg-gray-200'
  
  const score = passwordStrength.value.score
  const level = passwordStrength.value.level
  
  if (index <= score) {
    return {
      'bg-red-400': level === 'weak',
      'bg-orange-400': level === 'fair',
      'bg-yellow-400': level === 'good',
      'bg-green-400': level === 'strong',
      'bg-green-600': level === 'very-strong'
    }
  }
  return 'bg-gray-200'
}

// 表单验证规则
const rules: FormRules = {
  currentPassword: [
    {
      required: true,
      message: '请输入当前密码',
      trigger: ['input', 'blur']
    }
  ],
  newPassword: [
    {
      required: true,
      message: '请输入新密码',
      trigger: ['input', 'blur']
    },
    {
      min: 8,
      message: '密码长度至少8位',
      trigger: ['input', 'blur']
    },
    {
      validator: (rule: any, value: string) => {
        if (!value) return true
        
        const strength = checkPasswordStrength(value)
        if (!strength.isValid) {
          return new Error('密码强度不足，请满足所有密码要求')
        }
        
        // 检查与当前密码的相似度
        if (formData.currentPassword && calculatePasswordSimilarity(value, formData.currentPassword) > 0.7) {
          return new Error('新密码与当前密码过于相似')
        }
        
        return true
      },
      trigger: ['input', 'blur']
    }
  ],
  confirmPassword: [
    {
      required: true,
      message: '请确认新密码',
      trigger: ['input', 'blur']
    },
    {
      validator: (rule, value) => {
        return value === formData.newPassword
      },
      message: '两次输入的密码不一致',
      trigger: ['input', 'blur']
    }
  ]
}

// 表单是否有效
const isFormValid = computed(() => {
  return formData.currentPassword && 
         formData.newPassword && 
         formData.confirmPassword &&
         formData.newPassword === formData.confirmPassword &&
         passwordStrength.value?.isValid
})

// 新密码输入处理
const onNewPasswordInput = () => {
  if (formData.newPassword) {
    passwordStrength.value = checkPasswordStrength(formData.newPassword)
  } else {
    passwordStrength.value = null
  }
  clearErrors()
}

// 生成安全密码
const generateSecurePassword = () => {
  const suggestedPassword = generatePasswordSuggestion()
  formData.newPassword = suggestedPassword
  formData.confirmPassword = ''
  
  // 立即检查密码强度
  passwordStrength.value = checkPasswordStrength(suggestedPassword)
  
  message.info('已生成安全密码，请确认后使用')
}

// 清除错误
const clearErrors = () => {
  formRef.value?.restoreValidation()
}

// 重置表单
const resetForm = () => {
  formData.currentPassword = ''
  formData.newPassword = ''
  formData.confirmPassword = ''
  passwordStrength.value = null
  formRef.value?.restoreValidation()
}

// 取消操作
const handleCancel = () => {
  if (loading.value) return
  resetForm()
  showModal.value = false
}

// 确认修改
const handleConfirm = async () => {
  if (!formRef.value || loading.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    // 加密密码
    const encryptedCurrentPassword = await encodePassword(formData.currentPassword)
    const encryptedNewPassword = await encodePassword(formData.newPassword)

    const headers = addSecurityHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    })

    const response = await fetch('/api/user/password', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        currentPassword: encryptedCurrentPassword,
        newPassword: encryptedNewPassword
      })
    })

    const result = await response.json()
    if (result.success) {
      message.success('密码修改成功')
      resetForm()
      showModal.value = false
      emit('success')
    } else {
      message.error(result.message || '密码修改失败')
    }
  } catch (error: any) {
    if (error.message) {
      message.error(error.message)
    } else {
      message.error('网络错误，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

// 监听弹窗显示状态，重置表单
watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm()
  }
})
</script>

<style scoped>
.password-change-modal {
  max-height: 70vh;
  overflow-y: auto;
}

.password-strength {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.strength-bar {
  height: 8px;
}

.password-requirements {
  max-height: 120px;
  overflow-y: auto;
}

.password-feedback {
  max-height: 80px;
  overflow-y: auto;
}
</style>