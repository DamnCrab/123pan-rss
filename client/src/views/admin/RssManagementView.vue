<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <n-h1 class="!mb-0">RSS订阅管理</n-h1>
      <n-button type="primary" @click="showAddForm = true">
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
        添加RSS订阅
      </n-button>
    </div>

    <!-- 添加/编辑表单 -->
    <n-modal
      v-model:show="showAddForm"
      :mask-closable="false"
      preset="dialog"
      :title="editingRss ? '编辑RSS订阅' : '添加RSS订阅'"
      class="w-full max-w-2xl"
    >
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="top"
        require-mark-placement="right-hanging"
        @submit.prevent="submitForm"
      >
        <n-form-item path="rssUrl" label="RSS链接">
          <n-input
            v-model:value="formData.rssUrl"
            placeholder="https://example.com/rss.xml"
            clearable
          />
        </n-form-item>

        <n-form-item path="folderPath" label="文件夹路径">
          <n-cascader
            v-model:value="formData.folderPath"
            :options="folderOptions"
            :loading="loadingFolders"
            :on-load="handleLoadFolders"
            @update:value="handleFolderPathChange"
            @focus="initializeFolderOptions"
            placeholder="请选择文件夹路径"
            check-strategy="child"
            remote
            clearable
            filterable
            show-path
            separator=" / "
          />
        </n-form-item>

        <n-form-item path="folderName" label="文件夹名称">
          <n-input
            v-model:value="formData.folderName"
            placeholder="动漫下载"
            clearable
          />
        </n-form-item>

        <n-grid :cols="2" :x-gap="12">
          <n-grid-item>
            <n-form-item path="refreshInterval" label="刷新间隔">
              <n-input-number
                v-model:value="formData.refreshInterval"
                :min="1"
                placeholder="30"
                class="w-full"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item path="refreshUnit" label="时间单位">
              <n-select
                v-model:value="formData.refreshUnit"
                :options="[
                  { label: '分钟', value: 'minutes' },
                  { label: '小时', value: 'hours' }
                ]"
              />
            </n-form-item>
          </n-grid-item>
        </n-grid>

        <n-form-item path="isActive" label="启用状态">
          <n-switch v-model:value="formData.isActive">
            <template #checked>启用</template>
            <template #unchecked>停用</template>
          </n-switch>
        </n-form-item>
      </n-form>

      <template #action>
        <n-space>
          <n-button @click="cancelForm">取消</n-button>
          <n-button
            type="primary"
            :loading="loading"
            @click="submitForm"
          >
            {{ editingRss ? '更新' : '添加' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- RSS订阅列表 -->
    <n-spin :show="loading && !rssList.length">
      <div v-if="!rssList.length && !loading" class="flex justify-center py-12">
        <n-empty description="暂无RSS订阅，点击上方按钮添加第一个订阅" />
      </div>

      <n-grid v-else :cols="1" :md-cols="2" :lg-cols="3" :x-gap="16" :y-gap="16">
        <n-grid-item v-for="rss in rssList" :key="rss.id">
          <n-card
            :title="rss.folderName"
            size="small"
            hoverable
            :class="{ 'opacity-60': !rss.isActive }"
          >
            <template #header-extra>
              <n-tag
                :type="rss.isActive ? 'success' : 'warning'"
                size="small"
              >
                {{ rss.isActive ? '启用' : '停用' }}
              </n-tag>
            </template>

            <n-space vertical size="small">
              <div>
                <strong class="text-gray-600">RSS链接:</strong>
                <a
                  :href="rss.rssUrl"
                  target="_blank"
                  class="text-blue-500 hover:text-blue-600 break-all ml-2"
                >
                  {{ rss.rssUrl }}
                </a>
              </div>

              <div>
                <strong class="text-gray-600">文件夹路径:</strong>
                <span class="ml-2">{{ rss.folderPath }}</span>
              </div>

              <div>
                <strong class="text-gray-600">刷新频率:</strong>
                <span class="ml-2">
                  {{ rss.refreshInterval }} {{ rss.refreshUnit === 'minutes' ? '分钟' : '小时' }}
                </span>
              </div>

              <div>
                <strong class="text-gray-600">创建时间:</strong>
                <span class="ml-2">{{ formatDate(rss.createdAt) }}</span>
              </div>

              <div v-if="rss.lastRefresh">
                <strong class="text-gray-600">最后刷新:</strong>
                <span class="ml-2">{{ formatDate(rss.lastRefresh) }}</span>
              </div>
            </n-space>

            <template #action>
              <n-space>
                <n-button
                  size="small"
                  :type="rss.isActive ? 'warning' : 'success'"
                  @click="toggleRssStatus(rss)"
                >
                  {{ rss.isActive ? '停用' : '启用' }}
                </n-button>

                <n-button
                  size="small"
                  @click="editRss(rss)"
                >
                  <template #icon>
                    <n-icon><CreateOutline /></n-icon>
                  </template>
                  编辑
                </n-button>

                <n-popconfirm
                  @positive-click="deleteRss(rss.id)"
                  negative-text="取消"
                  positive-text="确定"
                >
                  <template #trigger>
                    <n-button
                      size="small"
                      type="error"
                    >
                      <template #icon>
                        <n-icon><TrashOutline /></n-icon>
                      </template>
                      删除
                    </n-button>
                  </template>
                  确定删除这个RSS订阅吗？
                </n-popconfirm>
              </n-space>
            </template>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NCascader,
  NButton,
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NSpace,
  NGrid,
  NGridItem,
  NTag,
  NIcon,
  NEmpty,
  NSpin,
  useMessage,
  NPopconfirm,
  NH1
} from 'naive-ui'
import type { CascaderOption, FormInst, FormRules } from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline, RefreshOutline } from '@vicons/ionicons5'

interface RssSubscription {
  id: number
  rssUrl: string
  folderPath: string
  folderName: string
  refreshInterval: number
  refreshUnit: 'minutes' | 'hours'
  isActive: number
  lastRefresh?: string
  createdAt: string
  updatedAt: string
}

interface FormData {
  rssUrl: string
  folderPath: number | string  // 支持文件夹ID或路径字符串
  folderName: string
  refreshInterval: number
  refreshUnit: 'minutes' | 'hours'
  isActive: boolean
}

interface FileItem {
  fileId: number
  filename: string
  type: number  // 1: 文件夹, 0: 文件
  parentFileId: number
  size: number
  createAt: string
  updateAt: string
}

interface FolderCascaderOption extends CascaderOption {
  value: number  // 使用 fileId 作为 value
  label: string  // 使用 filename 作为 label
  isLeaf?: boolean
  children?: FolderCascaderOption[]
}

const message = useMessage()
const formRef = ref<FormInst | null>(null)
const rssList = ref<RssSubscription[]>([])
const showAddForm = ref(false)
const editingRss = ref<RssSubscription | null>(null)
const loading = ref(false)

const formData = ref<FormData>({
  rssUrl: '',
  folderPath: '',  // 初始为空字符串，选择后会变为文件夹ID
  folderName: '',
  refreshInterval: 30,
  refreshUnit: 'minutes',
  isActive: true
})

// 级联选择器相关变量
const folderOptions = ref<FolderCascaderOption[]>([])
const loadingFolders = ref(false)

// 表单验证规则
const formRules: FormRules = {
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
      message: '请选择文件夹路径',
      trigger: ['change', 'blur']
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
    },
    {
      type: 'number',
      min: 1,
      message: '刷新间隔必须大于0',
      trigger: ['input', 'blur']
    }
  ]
}

// 获取RSS订阅列表
const fetchRssList = async () => {
  try {
    loading.value = true
    const response = await fetch('/api/rss', {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('获取RSS列表失败')
    }

    const result = await response.json()
    if (result.success) {
      rssList.value = result.data
    } else {
      message.error(result.message || '获取RSS列表失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    const url = editingRss.value ? `/api/rss/${editingRss.value.id}` : '/api/rss'
    const method = editingRss.value ? 'PUT' : 'POST'

    // 准备提交数据
    const submitData = {
      ...formData.value
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(submitData)
    })

    const result = await response.json()

    if (result.success) {
      message.success(result.message || '操作成功')
      cancelForm()
      await fetchRssList()
    } else {
      message.error(result.message || '操作失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 编辑RSS
const editRss = (rss: RssSubscription) => {
  editingRss.value = rss
  // 对于编辑模式，我们直接使用原始路径字符串
  // 级联选择器会根据这个值来显示选中状态
  formData.value = {
    rssUrl: rss.rssUrl,
    folderPath: rss.folderPath || '',
    folderName: rss.folderName,
    refreshInterval: rss.refreshInterval,
    refreshUnit: rss.refreshUnit,
    isActive: Boolean(rss.isActive)
  }
  showAddForm.value = true
}

// 删除RSS
const deleteRss = async (id: number) => {
  try {
    loading.value = true
    const response = await fetch(`/api/rss/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    const result = await response.json()

    if (result.success) {
      message.success(result.message || '删除成功')
      await fetchRssList()
    } else {
      message.error(result.message || '删除失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 切换RSS状态
const toggleRssStatus = async (rss: RssSubscription) => {
  try {
    loading.value = true
    const response = await fetch(`/api/rss/${rss.id}/toggle`, {
      method: 'PATCH',
      credentials: 'include'
    })

    const result = await response.json()

    if (result.success) {
      message.success(result.message || '操作成功')
      await fetchRssList()
    } else {
      message.error(result.message || '操作失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 取消表单
const cancelForm = () => {
  showAddForm.value = false
  editingRss.value = null
  formData.value = {
    rssUrl: '',
    folderPath: '',
    folderName: '',
    refreshInterval: 30,
    refreshUnit: 'minutes',
    isActive: true
  }
}

// 获取文件夹数据
const fetchFolders = async (parentFileId: number = 0): Promise<FolderCascaderOption[]> => {
  try {
    const response = await fetch(`/api/files?parentFileId=${parentFileId}`, {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('获取文件夹列表失败')
    }

    const result = await response.json()
    if (result.success) {
      // 只返回文件夹类型的数据 (type === 1)
      const folders = result.data.fileList.filter((item: FileItem) => item.type === 1)
      return folders.map((folder: FileItem) => ({
        value: folder.fileId,
        label: folder.filename,
        isLeaf: false // 假设所有文件夹都可能有子文件夹
      }))
    } else {
      message.error(result.message || '获取文件夹列表失败')
      return []
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
    return []
  }
}

// 级联选择器异步加载函数
const handleLoadFolders = async (option: CascaderOption) => {
  if (option.children) return

  loadingFolders.value = true
  try {
    // 根据选中的文件夹ID获取子文件夹
    const parentFileId = Number(option.value)
    const subFolders = await fetchFolders(parentFileId)
    option.children = subFolders
  } catch (error) {
    console.error('加载子文件夹失败:', error)
  } finally {
    loadingFolders.value = false
  }
}

// 初始化根文件夹选项 - 在聚焦时调用
const initializeFolderOptions = async () => {
  // 如果已经有数据，不重复加载
  if (folderOptions.value.length > 0) return

  loadingFolders.value = true
  try {
    const rootFolders = await fetchFolders(0)
    folderOptions.value = rootFolders
  } finally {
    loadingFolders.value = false
  }
}

// 处理文件夹路径变化
const handleFolderPathChange = (value: number | number[] | null) => {
  if (Array.isArray(value) && value.length > 0) {
    // 取最后一个选中的文件夹ID作为文件夹路径
    formData.value.folderPath = value[value.length - 1]
  } else if (typeof value === 'number') {
    formData.value.folderPath = value
  } else {
    formData.value.folderPath = ''
  }
}

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

// 组件挂载时获取数据
onMounted(() => {
  fetchRssList()
  // 文件夹选项将在用户聚焦时加载
})
</script>
