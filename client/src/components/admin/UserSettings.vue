<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-900 mb-6">用户设置</h2>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 修改管理员信息 -->
      <div class="bg-white p-6 rounded-lg border">
        <h3 class="text-lg font-medium text-gray-900 mb-4">修改管理员信息</h3>
        <n-form
          ref="adminFormRef"
          :model="adminForm"
          :rules="adminRules"
          label-placement="top"
        >
          <n-form-item path="newUsername" label="新用户名">
            <n-input
              v-model:value="adminForm.newUsername"
              placeholder="请输入新用户名"
            />
          </n-form-item>
          <n-form-item path="newPassword" label="新密码">
            <n-input
              v-model:value="adminForm.newPassword"
              type="password"
              placeholder="请输入新密码"
              show-password-on="mousedown"
            />
          </n-form-item>
          <n-form-item path="currentPassword" label="当前密码">
            <n-input
              v-model:value="adminForm.currentPassword"
              type="password"
              placeholder="请输入当前密码以确认"
              show-password-on="mousedown"
            />
          </n-form-item>
          <n-button
            type="primary"
            :loading="adminLoading"
            @click="handleUpdateAdmin"
            block
          >
            更新管理员信息
          </n-button>
        </n-form>
      </div>

      <!-- 修改密码 -->
      <div class="bg-white p-6 rounded-lg border">
        <h3 class="text-lg font-medium text-gray-900 mb-4">修改密码</h3>
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
          <n-button
            type="primary"
            :loading="passwordLoading"
            @click="handleChangePassword"
            block
          >
            修改密码
          </n-button>
        </n-form>
      </div>
    </div>

    <!-- 当前用户信息 -->
    <div class="mt-6 bg-gray-50 p-6 rounded-lg">
      <h3 class="text-lg font-medium text-gray-900 mb-4">当前用户信息</h3>
      <div v-if="userInfo">
        <n-descriptions :column="2" bordered>
          <n-descriptions-item label="用户ID">
            {{ userInfo.id }}
          </n-descriptions-item>
          <n-descriptions-item label="用户名">
            {{ userInfo.username }}
          </n-descriptions-item>
        </n-descriptions>
      </div>
      <n-skeleton v-else text :repeat="2" />
    </div>

    <!-- 系统信息 -->
    <div class="mt-6 bg-blue-50 p-6 rounded-lg">
      <h3 class="text-lg font-medium text-gray-900 mb-4">系统信息</h3>
      <n-descriptions :column="1" bordered>
        <n-descriptions-item label="系统版本">
          123-DMHY-RSS v1.0.0
        </n-descriptions-item>
        <n-descriptions-item label="最后登录时间">
          {{ lastLoginTime }}
        </n-descriptions-item>
        <n-descriptions-item label="在线时长">
          {{ onlineTime }}
        </n-descriptions-item>
      </n-descriptions>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NSkeleton,
  useMessage
} from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'

interface UserInfo {
  id: number
  username: string
}

const message = useMessage()
const adminFormRef = ref<FormInst | null>(null)
const passwordFormRef = ref<FormInst | null>(null)
const adminLoading = ref(false)
const passwordLoading = ref(false)
const userInfo = ref<UserInfo | null>(null)
const loginTime = ref<Date>(new Date())

const adminForm = reactive({
  newUsername: '',
  newPassword: '',
  currentPassword: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const adminRules: FormRules = {
  newUsername: [
    {
      required: true,
      message: '请输入新用户名',
      trigger: ['input', 'blur']
    },
    {
      min: 3,
      max: 20,
      message: '用户名长度应在3-20个字符之间',
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
      message: '密码长度不能少于6个字符',
      trigger: ['input', 'blur']
    }
  ],
  currentPassword: [
    {
      required: true,
      message: '请输入当前密码',
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
      message: '密码长度不能少于6个字符',
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

const lastLoginTime = computed(() => {
  return loginTime.value.toLocaleString()
})

const onlineTime = computed(() => {
  const now = new Date()
  const diff = now.getTime() - loginTime.value.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}小时${minutes}分钟`
})

const fetchUserInfo = async () => {
  try {
    const response = await fetch('/api/user/profile', {
      credentials: 'include'
    })
    if (response.ok) {
      userInfo.value = await response.json()
      // 设置当前用户名为默认值
      if (userInfo.value) {
        adminForm.newUsername = userInfo.value.username
      }
    } else {
      message.error('获取用户信息失败')
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    message.error('获取用户信息失败')
  }
}

const handleUpdateAdmin = async () => {
  if (!adminFormRef.value) return
  
  try {
    await adminFormRef.value.validate()
    adminLoading.value = true
    
    const response = await fetch('/api/user/admin/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(adminForm)
    })
    
    const result = await response.json()
    
    if (response.ok) {
      message.success('更新管理员信息成功')
      // 清空表单
      Object.assign(adminForm, {
        newUsername: userInfo.value?.username || '',
        newPassword: '',
        currentPassword: ''
      })
      // 重新获取用户信息
      fetchUserInfo()
    } else {
      message.error(result.message || '更新管理员信息失败')
    }
  } catch (error) {
    console.error('更新管理员信息失败:', error)
    message.error('更新管理员信息失败')
  } finally {
    adminLoading.value = false
  }
}

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  
  try {
    await passwordFormRef.value.validate()
    passwordLoading.value = true
    
    const response = await fetch('/api/user/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      message.success('修改密码成功')
      // 清空表单
      Object.assign(passwordForm, {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } else {
      message.error(result.message || '修改密码失败')
    }
  } catch (error) {
    console.error('修改密码失败:', error)
    message.error('修改密码失败')
  } finally {
    passwordLoading.value = false
  }
}

onMounted(() => {
  fetchUserInfo()
})
</script>