<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <n-h1 class="!mb-0">RSS订阅管理</n-h1>
      <n-space>
        <n-input
          v-model:value="searchKeyword"
          placeholder="搜索RSS订阅..."
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        >
          <template #suffix>
            <n-icon><SearchOutline /></n-icon>
          </template>
        </n-input>
        <n-button
          type="info"
          :loading="refreshingAll"
          @click="handleRefreshAll"
        >
          <template #icon>
            <n-icon><ReloadOutline /></n-icon>
          </template>
          刷新全部RSS订阅
        </n-button>
        <n-button type="primary" @click="showAddForm = true">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          添加RSS订阅
        </n-button>
      </n-space>
    </div>

    <!-- 添加/编辑表单 -->
    <RssFormModal
      v-model:show="showAddForm"
      :rss-data="editingRss"
      @submit-success="handleFormSuccess"
      @cancel="handleFormCancel"
    />

    <!-- RSS订阅列表 -->
    <n-spin :show="loading && (!rssList || !rssList.length)">
      <div v-if="(!rssList || !rssList.length) && !loading" class="flex justify-center py-12">
        <n-empty description="暂无RSS订阅，点击上方按钮添加第一个订阅" />
      </div>

      <n-grid v-else :cols="1" :md-cols="2" :lg-cols="3" :x-gap="16" :y-gap="16">
        <n-grid-item v-for="rss in (rssList || [])" :key="rss.id">
          <n-card
            :title="rss.cloudFolderName"
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
                <strong class="text-gray-600">父文件夹:</strong>
                <span class="ml-2">{{ rss.fatherFolderName }}</span>
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
                  @click="openMagnetModal(rss)"
                >
                  <template #icon>
                    <n-icon><LinkOutline /></n-icon>
                  </template>
                  磁力链接
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
      
      <!-- 分页组件 -->
      <div v-if="total > 0" class="flex justify-center mt-6">
        <n-pagination
          v-model:page="currentPage"
          :page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          show-quick-jumper
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
    </n-spin>

    <!-- 磁力链接管理弹窗 -->
    <MagnetLinksModal
      v-model:show="magnetModalVisible"
      :rss-id="selectedRssId"
      :rss-title="selectedRssTitle"
    />
  </div>
</template>

<script setup lang="ts">
import {AddOutline, CreateOutline, TrashOutline, LinkOutline, ReloadOutline, SearchOutline} from '@vicons/ionicons5'
import {
  deleteRSSSubscription,
  getRSSSubscriptions,
  toggleRSSSubscription
} from '@/api/rss'
import { triggerRSSUpdate } from '@/api/magnet'
import MagnetLinksModal from '@/components/MagnetLinksModal.vue'
import RssFormModal from '@/components/RssFormModal.vue'
import type { TimeUnit } from '@/api/types'

interface RssSubscription {
  id: number
  rssUrl: string
  fatherFolderId: string
  fatherFolderName: string
  cloudFolderName: string
  refreshInterval: number
  refreshUnit: TimeUnit
  isActive: number
  lastRefresh: number | null
  createdAt: number
  updatedAt: number
}

// 移除了FormData和FolderCascaderOption接口定义

const message = useMessage()
const rssList = ref<RssSubscription[]>([])
const showAddForm = ref(false)
const editingRss = ref<RssSubscription | null>(null)
const loading = ref(false)
const refreshingAll = ref(false)

// 分页相关状态
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')

// 磁力链接弹窗相关状态
const magnetModalVisible = ref(false)
const selectedRssId = ref<number>(0)
const selectedRssTitle = ref('')

// 获取RSS订阅列表
const fetchRssList = async () => {
  try {
    loading.value = true
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...(searchKeyword.value && { search: searchKeyword.value })
    }
    const result = await getRSSSubscriptions(params)
    console.log(result)
    if (result.success && result.data) {
      rssList.value = result.data.list || []
      total.value = result.data.total || 0
    } else {
      message.error(result.message || '获取RSS列表失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 表单提交成功处理函数
const handleFormSuccess = async () => {
  editingRss.value = null
  await fetchRssList()
}

// 表单取消处理函数
const handleFormCancel = () => {
  editingRss.value = null
}

// 编辑RSS
const editRss = (rss: RssSubscription) => {
  editingRss.value = rss
  showAddForm.value = true
}

// 删除RSS
const deleteRss = async (id: number) => {
  try {
    loading.value = true
    const result = await deleteRSSSubscription(id)

    if (result.success) {
      message.success(result.message || '删除成功')
      // 如果删除后当前页没有数据且不是第一页，则跳转到前一页
      if (rssList.value.length === 1 && currentPage.value > 1) {
        currentPage.value = currentPage.value - 1
      }
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
    const result = await toggleRSSSubscription(rss.id)

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

// 移除了不再需要的表单相关函数

// 格式化日期
const formatDate = (timestamp: number | string) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 打开磁力链接管理弹窗
const openMagnetModal = (rss: RssSubscription) => {
  selectedRssId.value = rss.id
  selectedRssTitle.value = rss.cloudFolderName
  magnetModalVisible.value = true
}

// 刷新全部RSS订阅
const handleRefreshAll = async () => {
  try {
    refreshingAll.value = true
    const result = await triggerRSSUpdate()
    
    if (result.success) {
      message.success(result.message || '刷新成功')
      await fetchRssList()
    } else {
      message.error(result.message || '刷新失败')
    }
  } catch (error) {
    message.error('网络错误，请稍后重试')
  } finally {
    refreshingAll.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  fetchRssList()
}

// 分页变化处理
const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchRssList()
}

// 每页数量变化处理
const handlePageSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  fetchRssList()
}

// 监听搜索关键词变化
watch(searchKeyword, () => {
  if (!searchKeyword.value) {
    currentPage.value = 1
    fetchRssList()
  }
})

// 组件挂载时获取数据
onMounted(() => {
  fetchRssList()
  // 文件夹选项将在用户聚焦时加载
})
</script>
