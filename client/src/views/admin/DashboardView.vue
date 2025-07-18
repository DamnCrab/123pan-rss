<template>
  <div>
    <n-h2 class="mb-6">仪表板</n-h2>
    <n-grid :cols="1" :md-cols="2" :lg-cols="4" :x-gap="16" :y-gap="16">
      <n-grid-item>
        <n-card>
          <n-statistic label="RSS订阅" :value="stats.rssCount">
            <template #prefix>
              <n-icon size="24" color="#18a058">
                <LogoRss />
              </n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card>
          <n-statistic label="下载任务" :value="stats.downloadCount">
            <template #prefix>
              <n-icon size="24" color="#2080f0">
                <CloudDownloadOutline />
              </n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card>
          <n-statistic label="待处理" :value="stats.pendingCount">
            <template #prefix>
              <n-icon size="24" color="#f0a020">
                <TimeOutline />
              </n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card>
          <n-statistic label="失败任务" :value="stats.failedCount">
            <template #prefix>
              <n-icon size="24" color="#d03050">
                <AlertCircleOutline />
              </n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 可以添加更多仪表板内容，如图表、最近活动等 -->
    <n-grid :cols="1" :x-gap="16" :y-gap="16" class="mt-6">
      <n-grid-item>
        <n-card title="最近RSS更新">
          <n-empty description="暂无最近更新" />
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
  NStatistic,
  NH2,
  NIcon,
  NEmpty,
  useMessage
} from 'naive-ui'
import {
  LogoRss,
  CloudDownloadOutline,
  TimeOutline,
  AlertCircleOutline
} from '@vicons/ionicons5'
import { getDashboardStats, type DashboardStats } from '@/api/dashboard'

const message = useMessage()

const stats = reactive<DashboardStats>({
  rssCount: 0,
  downloadCount: 0,
  pendingCount: 0,
  failedCount: 0,
  completedCount: 0,
  downloadingCount: 0
})

const fetchStats = async () => {
  try {
    const result = await getDashboardStats()
    if (result.success && result.data) {
      Object.assign(stats, result.data)
    } else {
      message.error(result.message || '获取统计数据失败')
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    message.error('获取统计数据失败')
  }
}

onMounted(() => {
  fetchStats()
})
</script>
