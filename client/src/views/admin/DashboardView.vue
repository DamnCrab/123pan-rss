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
    <n-grid :cols="1" :lg-cols="2" :x-gap="16" :y-gap="16" class="mt-6">
      <n-grid-item>
        <n-card title="最近RSS更新">
          <n-empty description="暂无最近更新" />
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card title="系统状态">
          <n-space vertical>
            <div class="flex justify-between">
              <span>系统运行时间</span>
              <n-tag type="success">正常</n-tag>
            </div>
            <div class="flex justify-between">
              <span>磁盘使用率</span>
              <n-tag type="info">65%</n-tag>
            </div>
            <div class="flex justify-between">
              <span>内存使用率</span>
              <n-tag type="warning">78%</n-tag>
            </div>
          </n-space>
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
  NSpace,
  NTag
} from 'naive-ui'
import {
  LogoRss,
  CloudDownloadOutline,
  TimeOutline,
  AlertCircleOutline
} from '@vicons/ionicons5'

const stats = reactive({
  rssCount: 0,
  downloadCount: 0,
  pendingCount: 0,
  failedCount: 0
})

const fetchStats = async () => {
  try {
    // 这里可以添加获取统计数据的API调用
    // 暂时使用模拟数据
    stats.rssCount = 5
    stats.downloadCount = 23
    stats.pendingCount = 3
    stats.failedCount = 1
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

onMounted(() => {
  fetchStats()
})
</script>
