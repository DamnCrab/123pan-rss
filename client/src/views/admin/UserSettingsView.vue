<template>
  <div>
    <n-h1 class="mb-6">用户设置</n-h1>

    <n-grid :cols="1" :lg-cols="2" :x-gap="16" :y-gap="16">
      <!-- 个人信息 -->
      <n-grid-item>
        <n-card title="个人信息">
          <n-form
            ref="profileFormRef"
            :model="profileForm"
            :rules="profileRules"
            label-placement="top"
          >
            <n-form-item path="username" label="用户名">
              <n-input v-model:value="profileForm.username" disabled />
            </n-form-item>
            <n-form-item path="email" label="邮箱">
              <n-input v-model:value="profileForm.email" placeholder="请输入邮箱" />
            </n-form-item>
            <n-form-item path="nickname" label="昵称">
              <n-input v-model:value="profileForm.nickname" placeholder="请输入昵称" />
            </n-form-item>
          </n-form>

          <template #action>
            <n-button type="primary" @click="updateProfile" :loading="updatingProfile">
              保存个人信息
            </n-button>
          </template>
        </n-card>
      </n-grid-item>

      <!-- 修改密码 -->
      <n-grid-item>
        <n-card title="修改密码">
          <div class="space-y-4">
            <div>
              <n-text>安全密码保护</n-text>
              <n-text depth="3" class="block text-sm mt-1">
                定期修改密码可以提高账户安全性
              </n-text>
            </div>
            
            <div class="flex items-center gap-3">
              <n-icon size="20" class="text-blue-500">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
                </svg>
              </n-icon>
              <div class="flex-1">
                <div class="text-sm font-medium">当前密码状态</div>
                <div class="text-xs text-gray-500">使用高强度加密保护</div>
              </div>
            </div>
          </div>

          <template #action>
            <n-button type="primary" @click="showPasswordModal = true">
              修改密码
            </n-button>
          </template>
        </n-card>
      </n-grid-item>

      <!-- 系统设置 -->
      <n-grid-item>
        <n-card title="系统设置">
          <n-form
            ref="systemFormRef"
            :model="systemForm"
            label-placement="top"
          >
            <n-form-item label="自动刷新RSS">
              <n-switch v-model:value="systemForm.autoRefreshRss">
                <template #checked>启用</template>
                <template #unchecked>禁用</template>
              </n-switch>
            </n-form-item>
            <n-form-item label="默认刷新间隔">
              <n-input-number
                v-model:value="systemForm.defaultRefreshInterval"
                :min="1"
                :max="1440"
                placeholder="分钟"
                class="w-full"
              />
            </n-form-item>
            <n-form-item label="最大并发下载数">
              <n-input-number
                v-model:value="systemForm.maxConcurrentDownloads"
                :min="1"
                :max="10"
                placeholder="个"
                class="w-full"
              />
            </n-form-item>
            <n-form-item label="下载完成通知">
              <n-switch v-model:value="systemForm.downloadNotification">
                <template #checked>启用</template>
                <template #unchecked>禁用</template>
              </n-switch>
            </n-form-item>
          </n-form>

          <template #action>
            <n-button type="primary" @click="updateSystemSettings" :loading="updatingSystem">
              保存系统设置
            </n-button>
          </template>
        </n-card>
      </n-grid-item>

      <!-- 数据管理 -->
      <n-grid-item>
        <n-card title="数据管理">
          <n-space vertical>
            <div>
              <n-text>清理日志文件</n-text>
              <n-text depth="3" class="block text-sm mt-1">
                清理30天前的系统日志文件
              </n-text>
            </div>
            <n-button @click="cleanLogs" :loading="cleaningLogs">
              清理日志
            </n-button>

            <n-divider />

            <div>
              <n-text>导出配置</n-text>
              <n-text depth="3" class="block text-sm mt-1">
                导出RSS订阅和系统配置
              </n-text>
            </div>
            <n-button @click="exportConfig" :loading="exporting">
              导出配置
            </n-button>

            <n-divider />

            <div>
              <n-text>导入配置</n-text>
              <n-text depth="3" class="block text-sm mt-1">
                从文件导入RSS订阅和系统配置
              </n-text>
            </div>
            <n-upload
              :show-file-list="false"
              accept=".json"
              @change="handleImportConfig"
            >
              <n-button>选择配置文件</n-button>
            </n-upload>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>
    
    <!-- 密码修改弹窗 -->
    <PasswordChangeModal 
      v-model:show="showPasswordModal" 
      @success="onPasswordChangeSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  NCard,
  NGrid,
  NGridItem,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NSwitch,
  NSpace,
  NText,
  NDivider,
  NUpload,
  NH1,
  useMessage
} from 'naive-ui'
import type { FormInst, FormRules, UploadFileInfo } from 'naive-ui'
import PasswordChangeModal from '@/components/PasswordChangeModal.vue'

const message = useMessage()

// 表单引用
const profileFormRef = ref<FormInst | null>(null)
const systemFormRef = ref<FormInst | null>(null)

// 加载状态
const updatingProfile = ref(false)
const updatingSystem = ref(false)
const cleaningLogs = ref(false)
const exporting = ref(false)

// 弹窗状态
const showPasswordModal = ref(false)

// 表单数据
const profileForm = reactive({
  username: '',
  email: '',
  nickname: ''
})

const systemForm = reactive({
  autoRefreshRss: true,
  defaultRefreshInterval: 30,
  maxConcurrentDownloads: 3,
  downloadNotification: true
})

// 表单验证规则
const profileRules: FormRules = {
  email: [
    {
      type: 'email',
      message: '请输入有效的邮箱地址',
      trigger: ['input', 'blur']
    }
  ]
}

// API 调用函数
const fetchUserProfile = async () => {
  try {
    const response = await fetch('/api/user/profile', {
      credentials: 'include'
    })
    const result = await response.json()
    if (result.success && result.data) {
      Object.assign(profileForm, result.data)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

const fetchSystemSettings = async () => {
  try {
    const response = await fetch('/api/system/settings', {
      credentials: 'include'
    })
    const result = await response.json()
    if (result.success && result.data) {
      Object.assign(systemForm, result.data)
    }
  } catch (error) {
    console.error('获取系统设置失败:', error)
  }
}

const updateProfile = async () => {
  if (!profileFormRef.value) return

  try {
    await profileFormRef.value.validate()
    updatingProfile.value = true

    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(profileForm)
    })

    const result = await response.json()
    if (result.success) {
      message.success('个人信息更新成功')
    } else {
      message.error(result.message || '更新失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    updatingProfile.value = false
  }
}

// 密码修改成功回调
const onPasswordChangeSuccess = () => {
  message.success('密码修改成功，请妥善保管新密码')
}

const updateSystemSettings = async () => {
  try {
    updatingSystem.value = true

    const response = await fetch('/api/system/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(systemForm)
    })

    const result = await response.json()
    if (result.success) {
      message.success('系统设置更新成功')
    } else {
      message.error(result.message || '更新失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    updatingSystem.value = false
  }
}

const cleanLogs = async () => {
  try {
    cleaningLogs.value = true

    const response = await fetch('/api/system/clean-logs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    const result = await response.json()
    if (result.success) {
      message.success('日志清理成功')
    } else {
      message.error(result.message || '清理失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    cleaningLogs.value = false
  }
}

const exportConfig = async () => {
  try {
    exporting.value = true

    const response = await fetch('/api/system/export-config', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `config-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      message.success('配置导出成功')
    } else {
      message.error('导出失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    exporting.value = false
  }
}

const handleImportConfig = async (options: { file: UploadFileInfo }) => {
  const file = options.file.file
  if (!file) return

  try {
    const formData = new FormData()
    formData.append('config', file)

    const response = await fetch('/api/system/import-config', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    })

    const result = await response.json()
    if (result.success) {
      message.success('配置导入成功')
      // 重新加载设置
      await fetchSystemSettings()
    } else {
      message.error(result.message || '导入失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

onMounted(() => {
  fetchUserProfile()
  fetchSystemSettings()
})
</script>
