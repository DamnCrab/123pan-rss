<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-900">RSS订阅管理</h2>
      <n-button type="primary" @click="showAddModal = true">
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
        添加订阅
      </n-button>
    </div>

    <!-- RSS订阅列表 -->
    <n-data-table
      :columns="columns"
      :data="rssData"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row) => row.id"
    />

    <!-- 添加RSS订阅模态框 -->
    <n-modal v-model:show="showAddModal" preset="dialog" title="添加RSS订阅">
      <n-form
        ref="addFormRef"
        :model="addForm"
        :rules="addRules"
        label-placement="left"
        label-width="auto"
      >
        <n-form-item path="rssUrl" label="RSS链接">
          <n-input v-model:value="addForm.rssUrl" placeholder="请输入RSS链接" />
        </n-form-item>
        <n-form-item path="folderPath" label="文件夹路径">
          <n-input v-model:value="addForm.folderPath" placeholder="请输入文件夹路径" />
        </n-form-item>
        <n-form-item path="folderName" label="文件夹名称">
          <n-input v-model:value="addForm.folderName" placeholder="请输入文件夹名称" />
        </n-form-item>
        <n-form-item path="refreshInterval" label="刷新间隔">
          <n-input-number v-model:value="addForm.refreshInterval" :min="1" placeholder="请输入刷新间隔" />
        </n-form-item>
        <n-form-item path="refreshUnit" label="时间单位">
          <n-select v-model:value="addForm.refreshUnit" :options="[
            { label: '分钟', value: 'minutes' },
            { label: '小时', value: 'hours' }
          ]" />
        </n-form-item>
        <n-form-item path="isActive" label="启用状态">
          <n-switch v-model:value="addForm.isActive" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showAddModal = false">取消</n-button>
          <n-button type="primary" :loading="addLoading" @click="handleAdd">
            添加
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 编辑RSS订阅模态框 -->
    <n-modal v-model:show="showEditModal" preset="dialog" title="编辑RSS订阅">
      <n-form
        ref="editFormRef"
        :model="editForm"
        :rules="addRules"
        label-placement="left"
        label-width="auto"
      >
        <n-form-item path="rssUrl" label="RSS链接">
          <n-input v-model:value="editForm.rssUrl" placeholder="请输入RSS链接" />
        </n-form-item>
        <n-form-item path="folderPath" label="文件夹路径">
          <n-input v-model:value="editForm.folderPath" placeholder="请输入文件夹路径" />
        </n-form-item>
        <n-form-item path="folderName" label="文件夹名称">
          <n-input v-model:value="editForm.folderName" placeholder="请输入文件夹名称" />
        </n-form-item>
        <n-form-item path="refreshInterval" label="刷新间隔">
          <n-input-number v-model:value="editForm.refreshInterval" :min="1" placeholder="请输入刷新间隔" />
        </n-form-item>
        <n-form-item path="refreshUnit" label="时间单位">
          <n-select v-model:value="editForm.refreshUnit" :options="[
            { label: '分钟', value: 'minutes' },
            { label: '小时', value: 'hours' }
          ]" />
        </n-form-item>
        <n-form-item path="isActive" label="启用状态">
          <n-switch v-model:value="editForm.isActive" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" :loading="editLoading" @click="handleEdit">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NDataTable,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NSpace,
  NIcon,
  NTag,
  NPopconfirm,
  useMessage
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  TrashOutline,
  RefreshOutline
} from '@vicons/ionicons5'
import type { FormInst, FormRules, DataTableColumns } from 'naive-ui'

interface RssSubscription {
  id: number
  userId: number
  rssUrl: string
  folderPath: string
  folderName: string
  refreshInterval: number
  refreshUnit: 'minutes' | 'hours'
  isActive: number
  lastRefresh: number | null
  createdAt: number
  updatedAt: number
}

const message = useMessage()
const loading = ref(false)
const addLoading = ref(false)
const editLoading = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const addFormRef = ref<FormInst | null>(null)
const editFormRef = ref<FormInst | null>(null)

const rssData = ref<RssSubscription[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onChange: (page: number) => {
    pagination.page = page
    fetchRssData()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    fetchRssData()
  }
})

const addForm = reactive({
  rssUrl: '',
  folderPath: '',
  folderName: '',
  refreshInterval: 60,
  refreshUnit: 'minutes' as 'minutes' | 'hours',
  isActive: true
})

const editForm = reactive({
  id: 0,
  rssUrl: '',
  folderPath: '',
  folderName: '',
  refreshInterval: 60,
  refreshUnit: 'minutes' as 'minutes' | 'hours',
  isActive: true
})

const addRules: FormRules = {
  rssUrl: [
    {
      required: true,
      message: '请输入RSS链接',
      trigger: ['input', 'blur']
    },
    {
      type: 'url',
      message: '请输入有效的URL',
      trigger: ['input', 'blur']
    }
  ],
  folderPath: [
    {
      required: true,
      message: '请输入文件夹路径',
      trigger: ['input', 'blur']
    }
  ],
  folderName: [
    {
      required: true,
      message: '请输入文件夹名称',
      trigger: ['input', 'blur']
    }
  ],
  refreshInterval: [
    {
      required: true,
      type: 'number',
      message: '请输入刷新间隔',
      trigger: ['input', 'blur']
    }
  ]
}

const columns: DataTableColumns<RssSubscription> = [
  {
    title: 'ID',
    key: 'id',
    width: 80
  },
  {
    title: '文件夹名称',
    key: 'folderName',
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: 'RSS链接',
    key: 'rssUrl',
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: '文件夹路径',
    key: 'folderPath',
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: '刷新间隔',
    key: 'refreshInterval',
    width: 120,
    render(row) {
      return `${row.refreshInterval} ${row.refreshUnit === 'minutes' ? '分钟' : '小时'}`
    }
  },
  {
    title: '状态',
    key: 'isActive',
    width: 100,
    render(row) {
      return h(
        NTag,
        {
          type: row.isActive ? 'success' : 'error'
        },
        {
          default: () => row.isActive ? '启用' : '禁用'
        }
      )
    }
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render(row) {
      return new Date(row.createdAt * 1000).toLocaleString()
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
                type: 'primary',
                ghost: true,
                onClick: () => handleEditClick(row)
              },
              {
                default: () => '编辑',
                icon: () => h(NIcon, null, { default: () => h(CreateOutline) })
              }
            ),
            h(
              NButton,
              {
                size: 'small',
                type: 'info',
                ghost: true,
                onClick: () => handleRefresh(row.id)
              },
              {
                default: () => '刷新',
                icon: () => h(NIcon, null, { default: () => h(RefreshOutline) })
              }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDelete(row.id)
              },
              {
                default: () => '确定删除这个RSS订阅吗？',
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

const fetchRssData = async () => {
  loading.value = true
  try {
    const response = await fetch(`/api/rss?page=${pagination.page}&limit=${pagination.pageSize}`, {
      credentials: 'include'
    })
    if (response.ok) {
      const result = await response.json()
      rssData.value = result.data || []
      pagination.itemCount = result.total || 0
    } else {
      message.error('获取RSS订阅列表失败')
    }
  } catch (error) {
    console.error('获取RSS订阅列表失败:', error)
    message.error('获取RSS订阅列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = async () => {
  if (!addFormRef.value) return
  
  try {
    await addFormRef.value.validate()
    addLoading.value = true
    
    const response = await fetch('/api/rss', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(addForm)
    })
    
    if (response.ok) {
      message.success('添加RSS订阅成功')
      showAddModal.value = false
      Object.assign(addForm, {
        rssUrl: '',
        folderPath: '',
        folderName: '',
        refreshInterval: 60,
        refreshUnit: 'minutes' as 'minutes' | 'hours',
        isActive: true
      })
      fetchRssData()
    } else {
      const result = await response.json()
      message.error(result.message || '添加RSS订阅失败')
    }
  } catch (error) {
    console.error('添加RSS订阅失败:', error)
    message.error('添加RSS订阅失败')
  } finally {
    addLoading.value = false
  }
}

const handleEditClick = (row: RssSubscription) => {
  Object.assign(editForm, row)
  showEditModal.value = true
}

const handleEdit = async () => {
  if (!editFormRef.value) return
  
  try {
    await editFormRef.value.validate()
    editLoading.value = true
    
    const response = await fetch(`/api/rss/${editForm.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        rssUrl: editForm.rssUrl,
        folderPath: editForm.folderPath,
        folderName: editForm.folderName,
        refreshInterval: editForm.refreshInterval,
        refreshUnit: editForm.refreshUnit,
        isActive: editForm.isActive
      })
    })
    
    if (response.ok) {
      message.success('更新RSS订阅成功')
      showEditModal.value = false
      fetchRssData()
    } else {
      const result = await response.json()
      message.error(result.message || '更新RSS订阅失败')
    }
  } catch (error) {
    console.error('更新RSS订阅失败:', error)
    message.error('更新RSS订阅失败')
  } finally {
    editLoading.value = false
  }
}

const handleDelete = async (id: number) => {
  try {
    const response = await fetch(`/api/rss/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    if (response.ok) {
      message.success('删除RSS订阅成功')
      fetchRssData()
    } else {
      const result = await response.json()
      message.error(result.message || '删除RSS订阅失败')
    }
  } catch (error) {
    console.error('删除RSS订阅失败:', error)
    message.error('删除RSS订阅失败')
  }
}

const handleRefresh = async (id: number) => {
  try {
    const response = await fetch(`/api/rss/${id}/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
    
    if (response.ok) {
      message.success('刷新RSS订阅成功')
    } else {
      const result = await response.json()
      message.error(result.message || '刷新RSS订阅失败')
    }
  } catch (error) {
    console.error('刷新RSS订阅失败:', error)
    message.error('刷新RSS订阅失败')
  }
}

onMounted(() => {
  fetchRssData()
})
</script>