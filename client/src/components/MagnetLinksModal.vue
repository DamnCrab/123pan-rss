<template>
  <n-modal
    v-model:show="visible"
    :mask-closable="false"
    preset="card"
    :title="`磁力链接管理 - ${rssTitle}`"
    class="w-4/5 max-w-screen-xl"
    :segmented="{
      content: 'soft',
      footer: 'soft'
    }"
  >
    <template #header-extra>
      <n-space>
        <n-button
          type="primary"
          size="small"
          :loading="refreshing"
          @click="handleRefreshRSS"
        >
          <template #icon>
            <n-icon><ReloadOutline /></n-icon>
          </template>
          刷新RSS
        </n-button>
        <n-button
          type="warning"
          size="small"
          :loading="retryingRss"
          @click="handleRetryRSS"
        >
          <template #icon>
            <n-icon><ReloadOutline /></n-icon>
          </template>
          下载失败重试
        </n-button>
        <n-button
          size="small"
          :loading="loading"
          @click="fetchMagnetLinks"
        >
          <template #icon>
            <n-icon><ReloadOutline /></n-icon>
          </template>
          刷新列表
        </n-button>
      </n-space>
    </template>

    <!-- 工具栏 -->
    <div class="mb-4">
      <n-space justify="space-between">
        <n-space>
          <n-input
            v-model:value="searchKeyword"
            placeholder="搜索标题、作者或分类"
            clearable
            style="width: 300px"
            @input="handleSearch"
          >
            <template #prefix>
              <n-icon><SearchOutline /></n-icon>
            </template>
          </n-input>
          <n-select
            v-model:value="statusFilter"
            placeholder="下载状态"
            clearable
            style="width: 150px"
            :options="statusOptions"
            @update:value="handleStatusFilter"
          />
        </n-space>
        <n-space>
          <n-button
            type="error"
            size="small"
            :disabled="!hasSelected"
            @click="handleBatchRetry"
          >
            批量重试
          </n-button>
          <n-button
            type="error"
            size="small"
            :disabled="!hasSelected"
            @click="handleBatchDelete"
          >
            批量删除
          </n-button>
        </n-space>
      </n-space>
    </div>

    <!-- 磁力链接列表 -->
    <n-data-table
      ref="tableRef"
      :columns="columns"
      :data="magnetLinks"
      :loading="loading"
      :pagination="paginationReactive"
      :row-key="(row: MagnetLink) => row.id"
      @update:checked-row-keys="handleCheckedRowKeysChange"
      remote
      striped
      size="small"
      flex-height
      style="height: 500px"
    />

    <template #footer>
      <div class="flex justify-between items-center">
        <n-text depth="3">
          共 {{ total }} 条记录，已选择 {{ checkedRowKeys.length }} 条
        </n-text>
<!--        <n-button @click="visible = false">关闭</n-button>-->
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { NButton, NTag, NSpace, NTooltip, NIcon, NPopconfirm, NEllipsis } from 'naive-ui'
import {
  RefreshOutline,
  ReloadOutline,
  SearchOutline,
  DownloadOutline,
  TrashOutline,
  LinkOutline,
} from '@vicons/ionicons5'
import {
  getMagnetLinks,
  refreshRSSSubscription,
  deleteMagnetLink,
  createOfflineDownload,
  batchRetryDownload,
  type MagnetLink, type MagnetListQuery
} from '@/api/magnet'
import {useDebounceFn} from "@vueuse/core";

interface Props {
  rssId?: number
  rssTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  rssId: 0,
  rssTitle: ''
})

const visible = defineModel<boolean>('show', { default: false })

const message = useMessage()
const dialog = useDialog()

// 数据状态
const magnetLinks = ref<MagnetLink[]>([])
const loading = ref(false)
const refreshing = ref(false)
const retryingRss = ref(false)
const total = ref(0)
const checkedRowKeys = ref<DataTableRowKey[]>([])

// 搜索和筛选
const searchKeyword = ref('')
const statusFilter = ref<string | null>(null)

// 分页
const paginationReactive = reactive({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    paginationReactive.page = page
    fetchMagnetLinks()
  },
  onUpdatePageSize: (pageSize: number) => {
    paginationReactive.pageSize = pageSize
    paginationReactive.page = 1
    fetchMagnetLinks()
  }
})

// 状态选项
const statusOptions = [
  { label: '等待下载', value: 'pending' },
  { label: '下载中', value: 'downloading' },
  { label: '已完成', value: 'completed' },
  { label: '下载失败', value: 'failed' }
]

// 计算属性
const hasSelected = computed(() => checkedRowKeys.value.length > 0)

// 表格列定义
const columns: DataTableColumns<MagnetLink> = [
  {
    type: 'selection'
  },
  {
    title: '标题',
    key: 'title',
    // width: 300,
    render(row) {
      return h(NEllipsis, {}, {
        default: () => row.title,
        tooltip: () => row.title
      })
    }
  },
  {
    title: '作者',
    key: 'author',
    width: 120,
    render(row) {
      return row.author || '-'
    }
  },
  {
    title: '分类',
    key: 'category',
    width: 100,
    render(row) {
      return row.category || '-'
    }
  },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render(row) {
      return row.size || '-'
    }
  },
  {
    title: '发布时间',
    key: 'pubDate',
    width: 90,
    render(row) {
      return row.pubDate ? new Date(row.pubDate).toLocaleDateString() : '-'
    }
  },
  {
    title: '下载状态',
    key: 'downloadStatus',
    width: 90,
    render(row) {
      const statusMap = {
        pending: { type: 'default', text: '等待下载' },
        downloading: { type: 'info', text: '下载中' },
        completed: { type: 'success', text: '已完成' },
        failed: { type: 'error', text: '下载失败' }
      }
      const status = statusMap[row.downloadStatus as keyof typeof statusMap]
      return h(NTag, { type: status.type as any, size: 'small' }, { default: () => status.text })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render(row) {
      return h(NSpace, { size: 'small' }, {
        default: () => [
          // 复制磁力链接
          h(NTooltip, { trigger: 'hover' }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'primary',
              quaternary: true,
              onClick: () => copyMagnetLink(row.magnetLink)
            }, {
              icon: () => h(NIcon, null, { default: () => h(LinkOutline) })
            }),
            default: () => '复制磁力链接'
          }),
          // 创建下载任务
          row.downloadStatus === 'pending' ? h(NTooltip, { trigger: 'hover' }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'info',
              quaternary: true,
              onClick: () => handleCreateDownload(row.id)
            }, {
              icon: () => h(NIcon, null, { default: () => h(DownloadOutline) })
            }),
            default: () => '创建下载'
          }) : null,
          // 重试下载
          row.downloadStatus === 'failed' ? h(NTooltip, { trigger: 'hover' }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'warning',
              quaternary: true,
              onClick: () => handleRetryDownload(row.id)
            }, {
              icon: () => h(NIcon, null, { default: () => h(RefreshOutline) })
            }),
            default: () => '重试下载'
          }) : null,
          // 删除
          h(NPopconfirm, {
            onPositiveClick: () => handleDeleteMagnet(row.id)
          }, {
            trigger: () => h(NTooltip, { trigger: 'hover' }, {
              trigger: () => h(NButton, {
                size: 'small',
                type: 'error',
                quaternary: true
              }, {
                icon: () => h(NIcon, null, { default: () => h(TrashOutline) })
              }),
              default: () => '删除'
            }),
            default: () => '确定删除这个磁力链接吗？'
          })
        ].filter(Boolean)
      })
    }
  }
]

// 获取磁力链接列表
const fetchMagnetLinks = async () => {
  try {
    loading.value = true
    const params: MagnetListQuery = {
      pageNum: paginationReactive.page.toString(),
      pageSize: paginationReactive.pageSize.toString()
    }
    
    // 只有当rssId存在且大于0时才添加rssId参数
    if (props.rssId && props.rssId > 0) {
      params.rssId = props.rssId.toString()
    }

    const result = await getMagnetLinks(params)
    if (result.success) {
      let data = result.data || []

      // 客户端筛选（如果服务端不支持的话）
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        data = data.filter(item =>
          item.title.toLowerCase().includes(keyword) ||
          (item.author && item.author.toLowerCase().includes(keyword)) ||
          (item.category && item.category.toLowerCase().includes(keyword))
        )
      }

      if (statusFilter.value) {
        data = data.filter(item => item.downloadStatus === statusFilter.value)
      }

      magnetLinks.value = data
      total.value = data.length
    } else {
      message.error(result.message || '获取磁力链接列表失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 刷新RSS订阅
const handleRefreshRSS = async () => {
  if (!props.rssId) return
  
  try {
    refreshing.value = true
    const result = await refreshRSSSubscription(props.rssId)
    if (result.success) {
      message.success('RSS刷新成功')
      await fetchMagnetLinks()
    } else {
      message.error(result.message || 'RSS刷新失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    refreshing.value = false
  }
}

// 重试RSS订阅下的所有失败任务
const handleRetryRSS = async () => {
  if (!props.rssId) return

  try {
    retryingRss.value = true
    const result = await batchRetryDownload({
      rssSubscriptionIds: [props.rssId]
    })
    if (result.success) {
      message.success(`重试RSS成功，共处理 ${result.data.total} 个任务，成功 ${result.data.success} 个`)
      await fetchMagnetLinks()
    } else {
      message.error(result.message || '重试RSS失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    retryingRss.value = false
  }
}

// 复制磁力链接
const copyMagnetLink = async (magnetLink: string) => {
  try {
    await navigator.clipboard.writeText(magnetLink)
    message.success('磁力链接已复制到剪贴板')
  } catch (error) {
    message.error('复制失败，请手动复制')
  }
}

// 创建下载任务
const handleCreateDownload = async (magnetId: number) => {
  try {
    const result = await createOfflineDownload(magnetId)
    if (result.success) {
      message.success('下载任务创建成功')
      await fetchMagnetLinks()
    } else {
      message.error(result.message || '创建下载任务失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

// 重试下载
const handleRetryDownload = async (magnetId: number) => {
  try {
    const result = await batchRetryDownload({ magnetIds: [magnetId] })
    if (result.success) {
      message.success('重试下载成功')
      await fetchMagnetLinks()
    } else {
      message.error(result.message || '重试下载失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

// 删除磁力链接
const handleDeleteMagnet = async (magnetId: number) => {
  try {
    const result = await deleteMagnetLink(magnetId)
    if (result.success) {
      message.success('删除成功')
      await fetchMagnetLinks()
    } else {
      message.error(result.message || '删除失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

// 批量重试
const handleBatchRetry = async () => {
  if (checkedRowKeys.value.length === 0) return

  try {
    const result = await batchRetryDownload({
      magnetIds: checkedRowKeys.value as number[]
    })
    if (result.success) {
      message.success('批量重试成功')
      checkedRowKeys.value = []
      await fetchMagnetLinks()
    } else {
      message.error(result.message || '批量重试失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  }
}

// 批量删除
const handleBatchDelete = () => {
  if (checkedRowKeys.value.length === 0) return

  dialog.warning({
    title: '确认删除',
    content: `确定要删除选中的 ${checkedRowKeys.value.length} 个磁力链接吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const promises = checkedRowKeys.value.map(id => deleteMagnetLink(id as number))
        await Promise.all(promises)
        message.success('批量删除成功')
        checkedRowKeys.value = []
        await fetchMagnetLinks()
      } catch (error) {
        message.error('批量删除失败')
      }
    }
  })
}

// 搜索处理
const handleSearch = useDebounceFn(() => {
  paginationReactive.page = 1
  fetchMagnetLinks()
}, 300)

// 状态筛选处理
const handleStatusFilter = () => {
  paginationReactive.page = 1
  fetchMagnetLinks()
}

// 选择行处理
const handleCheckedRowKeysChange = (rowKeys: DataTableRowKey[]) => {
  checkedRowKeys.value = rowKeys
}

// 清理数据
const clearData = () => {
  magnetLinks.value = []
  total.value = 0
  checkedRowKeys.value = []
  searchKeyword.value = ''
  statusFilter.value = null
  paginationReactive.page = 1
  paginationReactive.pageSize = 20
}

// 监听弹窗显示状态
watch(visible, (newVisible) => {
  console.log(newVisible)
  if (newVisible) {
    fetchMagnetLinks()
  } else {
    clearData()
  }
})

</script>

<style scoped>
.n-data-table :deep(.n-data-table-th) {
  font-weight: 600;
}

.n-data-table :deep(.n-data-table-td) {
  padding: 8px 12px;
}
</style>
