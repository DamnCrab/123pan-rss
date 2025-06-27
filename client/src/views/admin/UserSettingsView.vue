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
          <n-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-placement="top"
          >
            <n-form-item path="currentPassword" label="当前密码">
              <n-input
                v-model:value="passwordForm.currentPassword"
                type="password"
                placeholder="请输入当前密码"
                show-password-on="mousedown"
              />
            </n-form-item>
            <n-form-item path="newPassword" label="新密码">
              <n-input
                v-model:value="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码"
                show-password-on="mousedown"
              />
            </n-form-item>
            <n-form-item path="confirmPassword" label="确认新密码">
              <n-input
                v-model:value="passwordForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password-on="mousedown"
              />
            </n-form-item>
          </n-form>

          <template #action>
            <n-button type="primary" @click="changePassword" :loading="changingPassword">
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

const message = useMessage()

// 表单引用
const profileFormRef = ref<FormInst | null>(null)
const passwordFormRef = ref<FormInst | null>(null)
const systemFormRef = ref<FormInst | null>(null)

// 加载状态
const updatingProfile = ref(false)
const changingPassword = ref(false)
const updatingSystem = ref(false)
const cleaningLogs = ref(false)
const exporting = ref(false)

// 表单数据
const profileForm = reactive({
  username: '',
  email: '',
  nickname: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
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

const passwordRules: FormRules = {
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
      min: 6,
      message: '密码长度至少6位',
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
        return value === passwordForm.newPassword
      },
      message: '两次输入的密码不一致',
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
    if (result.success) {
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
    if (result.success) {
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

const changePassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate()
    changingPassword.value = true

    const response = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
    })

    const result = await response.json()
    if (result.success) {
      message.success('密码修改成功')
      // 清空表单
      passwordForm.currentPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    } else {
      message.error(result.message || '密码修改失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    changingPassword.value = false
  }
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
