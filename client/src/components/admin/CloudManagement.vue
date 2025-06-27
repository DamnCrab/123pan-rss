<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-900">云盘管理</h2>
      <n-space>
        <n-button type="primary" @click="handleBatchRetry" :disabled="!selectedRowKeys.length">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          批量重试
        </n-button>
        <n-button @click="fetchDownloadTasks">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          刷新
        </n-button>
      </n-space>
    </div>

    <!-- 筛选器 -->
    <div class="mb-4 p-4 bg-gray-50 rounded-lg">
      <n-space>
        <n-select
          v-model:value="filters.status"
          placeholder="选择状态"
          :options="statusOptions"
          clearable
          style="width: 150px"
          @update:value="fetchDownloadTasks"
        />
        <n-input
          v-model:value="filters.keyword"
          placeholder="搜索文件名"
          clearable
          style="width: 200px"
          @keyup.enter="fetchDownloadTasks"
        />
        <n-button @click="resetFilters">重置</n-button>
      </n-space>
    </div>

    <!-- 下载任务列表 -->
    <n-data-table
      :columns="columns"
      :data="downloadData"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row) => row.id"
      v-model:checked-row-keys="selectedRowKeys"
      :scroll-x="1200"
    />

    <!-- 文件详情模态框 -->
    <n-modal v-model:show="showDetailModal" preset="card" title="文件详情" style="width: 600px">
      <div v-if="selectedTask">
        <n-descriptions :column="1" bordered>
          <n-descriptions-item label="文件名">
            {{ selectedTask.fileName }}
          </n-descriptions-item>
          <n-descriptions-item label="磁力链接">
            <n-ellipsis style="max-width: 400px">
              {{ selectedTask.magnetLink }}
            </n-ellipsis>
          </n-descriptions-item>
          <n-descriptions-item label="状态">
            <n-tag :type="getStatusType(selectedTask.status)">
              {{ getStatusText(selectedTask.status) }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="文件大小">
            {{ formatFileSize(selectedTask.fileSize) }}
          </n-descriptions-item>
          <n-descriptions-item label="下载进度">
            <n-progress
              type="line"
              :percentage="selectedTask.progress"
              :status="selectedTask.status === 'failed' ? 'error' : 'default'"
            />
          </n-descriptions-item>
          <n-descriptions-item label="创建时间">
            {{ new Date(selectedTask.createdAt).toLocaleString() }}
          </n-descriptions-item>
          <n-descriptions-item label="更新时间">
            {{ new Date(selectedTask.updatedAt).toLocaleString() }}
          </n-descriptions-item>
          <n-descriptions-item v-if="selectedTask.errorMessage" label="错误信息">
            <n-text type="error">{{ selectedTask.errorMessage }}</n-text>
          </n-descriptions-item>
        </n-descriptions>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NDataTable,
  NButton,
  NModal,
  NSpace,
  NIcon,
  NTag,
  NSelect,
  NInput,
  NProgress,
  NDescriptions,
  NDescriptionsItem,
  NEllipsis,
  NText,
  NPopconfirm,
  useMessage
} from 'naive-ui'
import {
  RefreshOutline,
  EyeOutline,
  TrashOutline,
  DownloadOutline
} from '@vicons/ionicons5'
import type { DataTableColumns } from 'naive-ui'

interface DownloadTask {
  id: number
  fileName: string
  magnetLink: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  progress: number
  fileSize: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

const message = useMessage()
const loading = ref(false)
const showDetailModal = ref(false)
const selectedTask = ref<DownloadTask | null>(null)
const selectedRowKeys = ref<number[]>([])

const downloadData = ref<DownloadTask[]>([])
const filters = reactive({
  status: null as string | null,
  keyword: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onChange: (page: number) => {
    pagination.page = page
    fetchDownloadTasks()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchDownloadTasks()
  }
})

const statusOptions = [
  { label: '等待中', value: 'pending' },
  { label: '下载中', value: 'downloading' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' }
]

const getStatusType = (status: string) => {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    downloading: 'info',
    completed: 'success',
    failed: 'error'
  }
  return typeMap[status] || 'default'
}

const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败'
  }
  return textMap[status] || status
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const columns: DataTableColumns<DownloadTask> = [
  {
    type: 'selection'
  },
  {
    title: 'ID',
    key: 'id',
    width: 80
  },
  {
    title: '文件名',
    key: 'fileName',
    width: 300,
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      return h(
        NTag,
        {
          type: getStatusType(row.status)
        },
        {
          default: () => getStatusText(row.status)
        }
      )
    }
  },
  {
    title: '进度',
    key: 'progress',
    width: 150,
    render(row) {
      return h(
        NProgress,
        {
          type: 'line',
          percentage: row.progress,
          status: row.status === 'failed' ? 'error' : 'default',
          showIndicator: false
        }
      )
    }
  },
  {
    title: '文件大小',
    key: 'fileSize',
    width: 120,
    render(row) {
      return formatFileSize(row.fileSize)
    }
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render(row) {
      return h(
        NSpace,
        {},
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                type: 'info',
                ghost: true,
                onClick: () => handleViewDetail(row)
              },
              {
                default: () => '详情',
                icon: () => h(NIcon, null, { default: () => h(EyeOutline) })
              }
            ),
            ...(row.status === 'failed' ? [
              h(
                NButton,
                {
                  size: 'small',
                  type: 'warning',
                  ghost: true,
                  onClick: () => handleRetry(row.id)
                },
                {
                  default: () => '重试',
                  icon: () => h(NIcon, null, { default: () => h(RefreshOutline) })
                }
              )
            ] : []),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDelete(row.id)
              },
              {
                default: () => '确定删除这个下载任务吗？',
                trigger: () => h(
                  NButton,
                  {
                    size: 'small',
                    type: 'error',
                    ghost: true
                  },
                  {
                    default: () => '删除',
                    icon: () => h(NIcon, null, { default: () => h(TrashOutline) })
                  }
                )
              }
            )
          ]
        }
      )
    }
  }
]

const fetchDownloadTasks = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.pageSize.toString()
    })
    
    if (filters.status) {
      params.append('status', filters.status)
    }
    if (filters.keyword) {
      params.append('keyword', filters.keyword)
    }
    
    const response = await fetch(`/api/cloud123/downloads?${params}`, {
      credentials: 'include'
    })
    
    if (response.ok) {
      const result = await response.json()
      downloadData.value = result.data || []
      pagination.itemCount = result.total || 0
    } else {
      message.error('获取下载任务列表失败')
    }
  } catch (error) {
    console.error('获取下载任务列表失败:', error)
    message.error('获取下载任务列表失败')
  } finally {
    loading.value = false
  }
}

const handleViewDetail = (task: DownloadTask) => {
  selectedTask.value = task
  showDetailModal.value = true
}

const handleRetry = async (id: number) => {
  try {
    const response = await fetch('/api/cloud123/batch-retry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        magnetIds: [id]
      })
    })
    
    if (response.ok) {
      message.success('重试任务成功')
      fetchDownloadTasks()
    } else {
      const result = await response.json()
      message.error(result.message || '重试任务失败')
    }
  } catch (error) {
    console.error('重试任务失败:', error)
    message.error('重试任务失败')
  }
}

const handleBatchRetry = async () => {
  if (!selectedRowKeys.value.length) {
    message.warning('请选择要重试的任务')
    return
  }
  
  try {
    const response = await fetch('/api/cloud123/batch-retry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        magnetIds: selectedRowKeys.value
      })
    })
    
    if (response.ok) {
      message.success('批量重试任务成功')
      selectedRowKeys.value = []
      fetchDownloadTasks()
    } else {
      const result = await response.json()
      message.error(result.message || '批量重试任务失败')
    }
  } catch (error) {
    console.error('批量重试任务失败:', error)
    message.error('批量重试任务失败')
  }
}

const handleDelete = async (id: number) => {
  try {
    const response = await fetch(`/api/cloud123/downloads/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    if (response.ok) {
      message.success('删除下载任务成功')
      fetchDownloadTasks()
    } else {
      const result = await response.json()
      message.error(result.message || '删除下载任务失败')
    }
  } catch (error) {
    console.error('删除下载任务失败:', error)
    message.error('删除下载任务失败')
  }
}

const resetFilters = () => {
  filters.status = null
  filters.keyword = ''
  fetchDownloadTasks()
}

onMounted(() => {
  fetchDownloadTasks()
})
</script>