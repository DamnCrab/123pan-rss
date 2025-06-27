<template>
  <div>
    <n-h1 class="mb-6">云盘管理</n-h1>

    <!-- 云盘账户信息 -->
    <n-card title="云盘账户" class="mb-6">
      <n-space vertical>
        <div class="flex justify-between items-center">
          <span>账户状态:</span>
          <n-tag :type="accountStatus === 'connected' ? 'success' : 'error'">
            {{ accountStatus === 'connected' ? '已连接' : '未连接' }}
          </n-tag>
        </div>
        <div class="flex justify-between items-center">
          <span>存储空间:</span>
          <span>{{ storageInfo.used }} / {{ storageInfo.total }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span>上次同步:</span>
          <span>{{ lastSync || '从未同步' }}</span>
        </div>
      </n-space>

      <template #action>
        <n-space>
          <n-button type="primary" @click="showAccountModal = true">
            {{ accountStatus === 'connected' ? '重新配置' : '配置账户' }}
          </n-button>
          <n-button @click="syncAccount" :loading="syncing">
            同步账户信息
          </n-button>
        </n-space>
      </template>
    </n-card>

    <!-- 下载任务列表 -->
    <n-card title="下载任务">
      <template #header-extra>
        <n-space>
          <n-button @click="refreshTasks" :loading="loading">
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
            刷新
          </n-button>
          <n-button type="primary" @click="showAddTaskModal = true">
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            添加任务
          </n-button>
        </n-space>
      </template>

      <n-data-table
        :columns="columns"
        :data="tasks"
        :loading="loading"
        :pagination="pagination"
        :row-key="(row) => row.id"
      />
    </n-card>

    <!-- 配置账户模态框 -->
    <n-modal v-model:show="showAccountModal" preset="dialog" title="配置云盘账户">
      <n-form
        ref="accountFormRef"
        :model="accountForm"
        :rules="accountRules"
        label-placement="top"
      >
        <n-form-item path="username" label="用户名">
          <n-input v-model:value="accountForm.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item path="password" label="密码">
          <n-input
            v-model:value="accountForm.password"
            type="password"
            placeholder="请输入密码"
            show-password-on="mousedown"
          />
        </n-form-item>
      </n-form>

      <template #action>
        <n-space>
          <n-button @click="showAccountModal = false">取消</n-button>
          <n-button type="primary" @click="saveAccount" :loading="saving">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 添加任务模态框 -->
    <n-modal v-model:show="showAddTaskModal" preset="dialog" title="添加下载任务">
      <n-form
        ref="taskFormRef"
        :model="taskForm"
        :rules="taskRules"
        label-placement="top"
      >
        <n-form-item path="magnetLink" label="磁力链接">
          <n-input
            v-model:value="taskForm.magnetLink"
            type="textarea"
            placeholder="请输入磁力链接"
            :rows="3"
          />
        </n-form-item>
        <n-form-item path="savePath" label="保存路径">
          <n-input v-model:value="taskForm.savePath" placeholder="请输入保存路径" />
        </n-form-item>
      </n-form>

      <template #action>
        <n-space>
          <n-button @click="showAddTaskModal = false">取消</n-button>
          <n-button type="primary" @click="addTask" :loading="adding">
            添加
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NCard,
  NSpace,
  NTag,
  NButton,
  NIcon,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NH1,
  useMessage
} from 'naive-ui'
import type { FormInst, FormRules, DataTableColumns } from 'naive-ui'
import { RefreshOutline, AddOutline, TrashOutline, PauseOutline, PlayOutline } from '@vicons/ionicons5'

interface DownloadTask {
  id: number
  name: string
  magnetLink: string
  savePath: string
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused'
  progress: number
  size: string
  speed: string
  createdAt: string
}

const message = useMessage()
const accountFormRef = ref<FormInst | null>(null)
const taskFormRef = ref<FormInst | null>(null)

// 状态管理
const loading = ref(false)
const syncing = ref(false)
const saving = ref(false)
const adding = ref(false)
const showAccountModal = ref(false)
const showAddTaskModal = ref(false)

// 账户信息
const accountStatus = ref<'connected' | 'disconnected'>('disconnected')
const storageInfo = reactive({
  used: '0 GB',
  total: '0 GB'
})
const lastSync = ref('')

// 表单数据
const accountForm = reactive({
  username: '',
  password: ''
})

const taskForm = reactive({
  magnetLink: '',
  savePath: ''
})

// 任务列表
const tasks = ref<DownloadTask[]>([])

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onChange: (page: number) => {
    pagination.page = page
    fetchTasks()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchTasks()
  }
})

// 表单验证规则
const accountRules: FormRules = {
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

const taskRules: FormRules = {
  magnetLink: [
    {
      required: true,
      message: '请输入磁力链接',
      trigger: ['input', 'blur']
    }
  ],
  savePath: [
    {
      required: true,
      message: '请输入保存路径',
      trigger: ['input', 'blur']
    }
  ]
}

// 表格列定义
const columns: DataTableColumns<DownloadTask> = [
  {
    title: '任务名称',
    key: 'name',
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      const statusMap = {
        pending: { type: 'info', text: '等待中' },
        downloading: { type: 'primary', text: '下载中' },
        completed: { type: 'success', text: '已完成' },
        failed: { type: 'error', text: '失败' },
        paused: { type: 'warning', text: '已暂停' }
      }
      const status = statusMap[row.status] || { type: 'default', text: '未知' }
      return h(NTag, { type: status.type as any }, { default: () => status.text })
    }
  },
  {
    title: '进度',
    key: 'progress',
    width: 100,
    render(row) {
      return `${row.progress}%`
    }
  },
  {
    title: '大小',
    key: 'size',
    width: 100
  },
  {
    title: '速度',
    key: 'speed',
    width: 100
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 150,
    render(row) {
      return new Date(row.createdAt).toLocaleString('zh-CN')
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render(row) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, {
            size: 'small',
            type: row.status === 'paused' ? 'primary' : 'warning',
            onClick: () => toggleTask(row.id, row.status)
          }, {
            default: () => row.status === 'paused' ? '继续' : '暂停',
            icon: () => h(NIcon, null, {
              default: () => h(row.status === 'paused' ? PlayOutline : PauseOutline)
            })
          }),
          h(NButton, {
            size: 'small',
            type: 'error',
            onClick: () => deleteTask(row.id)
          }, {
            default: () => '删除',
            icon: () => h(NIcon, null, { default: () => h(TrashOutline) })
          })
        ]
      })
    }
  }
]

// API 调用函数
const fetchAccountInfo = async () => {
  try {
    const response = await fetch('/api/cloud123/account', {
      credentials: 'include'
    })
    const result = await response.json()
    if (result.success) {
      accountStatus.value = result.data.connected ? 'connected' : 'disconnected'
      storageInfo.used = result.data.used || '0 GB'
      storageInfo.total = result.data.total || '0 GB'
      lastSync.value = result.data.lastSync || ''
    }
  } catch (error) {
    console.error('获取账户信息失败:', error)
  }
}

const fetchTasks = async () => {
  try {
    loading.value = true
    const response = await fetch(`/api/cloud123/tasks?page=${pagination.page}&pageSize=${pagination.pageSize}`, {
      credentials: 'include'
    })
    const result = await response.json()
    if (result.success) {
      tasks.value = result.data.tasks || []
      // pagination.itemCount = result.data.total || 0
    } else {
      message.error(result.message || '获取任务列表失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

const syncAccount = async () => {
  try {
    syncing.value = true
    const response = await fetch('/api/cloud123/sync', {
      method: 'POST',
      credentials: 'include'
    })
    const result = await response.json()
    if (result.success) {
      message.success('同步成功')
      await fetchAccountInfo()
    } else {
      message.error(result.message || '同步失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    syncing.value = false
  }
}

const saveAccount = async () => {
  if (!accountFormRef.value) return

  try {
    await accountFormRef.value.validate()
    saving.value = true

    const response = await fetch('/api/cloud123/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(accountForm)
    })

    const result = await response.json()
    if (result.success) {
      message.success('账户配置成功')
      showAccountModal.value = false
      await fetchAccountInfo()
    } else {
      message.error(result.message || '配置失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    saving.value = false
  }
}

const addTask = async () => {
  if (!taskFormRef.value) return

  try {
    await taskFormRef.value.validate()
    adding.value = true

    const response = await fetch('/api/cloud123/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(taskForm)
    })

    const result = await response.json()
    if (result.success) {
      message.success('任务添加成功')
      showAddTaskModal.value = false
      taskForm.magnetLink = ''
      taskForm.savePath = ''
      await fetchTasks()
    } else {
      message.error(result.message || '添加失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    adding.value = false
  }
}

const toggleTask = async (id: number, status: string) => {
  try {
    const action = status === 'paused' ? 'resume' : 'pause'
    const response = await fetch(`/api/cloud123/tasks/${id}/${action}`, {
      method: 'POST',
      credentials: 'include'
    })

    const result = await response.json()
    if (result.success) {
      message.success(`任务${action === 'pause' ? '暂停' : '继续'}成功`)
      await fetchTasks()
    } else {
      message.error(result.message || '操作失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

const deleteTask = async (id: number) => {
  try {
    const response = await fetch(`/api/cloud123/tasks/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    const result = await response.json()
    if (result.success) {
      message.success('任务删除成功')
      await fetchTasks()
    } else {
      message.error(result.message || '删除失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

const refreshTasks = () => {
  fetchTasks()
}

onMounted(() => {
  fetchAccountInfo()
  fetchTasks()
})
</script>
