<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <n-card class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900">123-DMHY-RSS</h1>
          <p class="text-gray-600 mt-2">管理员登录</p>
        </div>
      </template>

      <n-form
        ref="formRef"
        :model="loginForm"
        :rules="rules"
        @submit.prevent="handleLogin"
        size="large"
      >
        <n-form-item path="username" label="用户名">
          <n-input
            v-model:value="loginForm.username"
            placeholder="请输入用户名"
            clearable
          />
        </n-form-item>

        <n-form-item path="password" label="密码">
          <n-input
            v-model:value="loginForm.password"
            type="password"
            placeholder="请输入密码"
            show-password-on="mousedown"
            clearable
            @keydown.enter="handleLogin"
          />
        </n-form-item>

        <n-form-item>
          <n-button
            type="primary"
            size="large"
            block
            :loading="loading"
            attr-type="submit"
          >
            登录
          </n-button>
        </n-form-item>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NCard, useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import { login, type LoginParams } from '@/api'

const router = useRouter()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const loginForm = reactive<LoginParams>({
  username: '',
  password: ''
})

const rules: FormRules = {
  username: [
    {
      required: true,
      message: '请输入用户名',
      trigger: ['input', 'blur']
    }
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
      trigger: ['input', 'blur']
    }
  ]
}

const handleLogin = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    const result = await login(loginForm)

    if (result.success && result.data) {
      // 保存token到localStorage
      localStorage.setItem('token', result.data.token)

      message.success(result.message || '登录成功')
      router.push('/admin')
    } else {
      message.error(result.message || '登录失败')
    }
  } catch (error: any) {
    console.error('登录错误:', error)
    message.error('登录失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>
