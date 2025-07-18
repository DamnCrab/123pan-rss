<template>
  <div class="error-boundary">
    <n-result
      status="error"
      :title="errorTitle"
      :description="errorDescription"
    >
      <template #footer>
        <n-space>
          <n-button @click="retry" type="primary">
            重试
          </n-button>
          <n-button @click="goHome" type="default">
            返回首页
          </n-button>
          <n-button 
            v-if="showDetails" 
            @click="toggleDetails" 
            type="tertiary"
          >
            {{ showErrorDetails ? '隐藏详情' : '显示详情' }}
          </n-button>
        </n-space>
      </template>
    </n-result>
    
    <n-collapse-transition :show="showErrorDetails">
      <n-card class="error-details" title="错误详情">
        <n-code :code="errorDetails" language="javascript" />
      </n-card>
    </n-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NResult, NButton, NSpace, NCard, NCode, NCollapseTransition } from 'naive-ui'
import { appConfig } from '@/config'

interface Props {
  error?: Error | null
  errorInfo?: string
  showDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  error: null,
  errorInfo: '',
  showDetails: false
})

const emit = defineEmits<{
  retry: []
}>()

const router = useRouter()
const showErrorDetails = ref(false)

const errorTitle = computed(() => {
  if (props.error?.name === 'ChunkLoadError') {
    return '资源加载失败'
  }
  return props.error?.name || '应用程序错误'
})

const errorDescription = computed(() => {
  if (props.error?.name === 'ChunkLoadError') {
    return '页面资源加载失败，可能是网络问题或应用已更新，请尝试刷新页面。'
  }
  return props.error?.message || '应用程序遇到了一个意外错误，请稍后重试。'
})

const errorDetails = computed(() => {
  const details = []
  
  if (props.error) {
    details.push(`错误名称: ${props.error.name}`)
    details.push(`错误信息: ${props.error.message}`)
    
    if (props.error.stack) {
      details.push(`错误堆栈:\n${props.error.stack}`)
    }
  }
  
  if (props.errorInfo) {
    details.push(`组件信息:\n${props.errorInfo}`)
  }
  
  details.push(`时间: ${new Date().toLocaleString()}`)
  details.push(`环境: ${appConfig.isDevelopment ? '开发' : '生产'}`)
  
  return details.join('\n\n')
})

const retry = () => {
  emit('retry')
}

const goHome = () => {
  router.push('/')
}

const toggleDetails = () => {
  showErrorDetails.value = !showErrorDetails.value
}
</script>

<style scoped>
.error-boundary {
  padding: 20px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.error-details {
  margin-top: 20px;
  max-width: 800px;
  width: 100%;
}
</style>