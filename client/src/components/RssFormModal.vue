<template>
  <n-modal
    v-model:show="show"
    :mask-closable="false"
    preset="dialog"
    :title="isEditing ? '编辑RSS订阅' : '添加RSS订阅'"
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
      <n-form-item path="fatherFolderName" label="选择文件夹">
        <n-cascader
          v-model:value="formData.fatherFolderId"
          :disabled="!!isEditing"
          :options="folderOptions"
          :loading="loadingFolders"
          :on-load="handleLoadFolders"
          allow-checking-not-loaded
          @update:value="handleFolderPathChange"
          @focus="initializeFolderOptions"
          placeholder="请选择文件夹"
          check-strategy="all"
          remote
          clearable
          show-path
          separator=" / "
        />
      </n-form-item>

      <n-form-item path="cloudFolderName" label="文件夹名称">
        <n-input
          v-model:value="formData.cloudFolderName"
          placeholder="请输入要创建的文件夹名称"
          clearable
          :disabled="!!isEditing"
        />
        <template #feedback>
          <span class="text-gray-500 text-sm">此名称将用于在123云盘中创建文件夹，创建后不可修改</span>
        </template>
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
        <n-button @click="handleCancel">取消</n-button>
        <n-button
          type="primary"
          :loading="loading"
          @click="submitForm"
        >
          {{ isEditing ? '更新' : '添加' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { CascaderOption, FormInst, FormRules } from 'naive-ui'
import { type FileInfo, type FileListQuery, getFileList } from '@/api/cloud'
import {
  createRSSSubscription,
  type CreateRSSSubscriptionParams,
  updateRSSSubscription,
  type UpdateRSSSubscriptionParams
} from '@/api/rss'
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

interface FormData {
  rssUrl: string
  fatherFolderId: number
  fatherFolderName: string
  cloudFolderName: string
  refreshInterval: number
  refreshUnit: TimeUnit
  isActive: boolean
}

// Props定义
interface Props {
  show: boolean
  rssData?: RssSubscription | null
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  rssData: null
})

// Emits定义
interface Emits {
  'update:show': [value: boolean]
  'submit-success': []
  'cancel': []
}

const emit = defineEmits<Emits>()

// 响应式数据
import { useMessage } from 'naive-ui'
const message = useMessage()
const formRef = ref<FormInst>()
const loading = ref(false)
const loadingFolders = ref(false)
const folderOptions = ref<FolderCascaderOption[]>([])

// 计算属性
const show = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const isEditing = computed(() => !!props.rssData)

// 表单数据
const formData = ref<FormData>({
  rssUrl: '',
  fatherFolderId: 0,
  fatherFolderName: '',
  cloudFolderName: '',
  refreshInterval: 30,
  refreshUnit: 'minutes',
  isActive: true
})

// 表单验证规则
const formRules: FormRules = {
  rssUrl: [
    { required: true, message: '请输入RSS链接', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL', trigger: 'blur' }
  ],
  fatherFolderId: [
    { required: true, type: 'number', message: '请选择文件夹', trigger: 'change' }
  ],
  cloudFolderName: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' }
  ],
  refreshInterval: [
    { required: true, type: 'number', message: '请输入刷新间隔', trigger: 'blur' },
    { type: 'number', min: 1, message: '刷新间隔必须大于0', trigger: 'blur' }
  ]
}

// 文件夹级联选择器选项类型
interface FolderCascaderOption extends CascaderOption {
  value: number
  label: string
  isLeaf?: boolean
  children?: FolderCascaderOption[]
}

// 重置表单
const resetForm = () => {
  formData.value = {
    rssUrl: '',
    fatherFolderId: 0,
    fatherFolderName: '',
    cloudFolderName: '',
    refreshInterval: 30,
    refreshUnit: 'minutes',
    isActive: true
  }
}

// 监听props.rssData变化，初始化表单数据
watch(() => props.rssData, (newRssData) => {
  if (newRssData) {
    formData.value = {
      rssUrl: newRssData.rssUrl,
      fatherFolderId: parseInt(newRssData.fatherFolderId),
      fatherFolderName: newRssData.fatherFolderName,
      cloudFolderName: newRssData.cloudFolderName,
      refreshInterval: newRssData.refreshInterval,
      refreshUnit: newRssData.refreshUnit,
      isActive: !!newRssData.isActive
    }
  } else {
    resetForm()
  }
}, { immediate: true })

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    // 准备提交数据
    const submitData: CreateRSSSubscriptionParams | UpdateRSSSubscriptionParams = {
      rssUrl: formData.value.rssUrl,
      fatherFolderId: formData.value.fatherFolderId.toString(),
      fatherFolderName: formData.value.fatherFolderName,
      cloudFolderName: formData.value.cloudFolderName,
      refreshInterval: formData.value.refreshInterval,
      refreshUnit: formData.value.refreshUnit,
      isActive: formData.value.isActive
    }

    let result
    if (isEditing.value && props.rssData) {
      // 更新RSS订阅
      result = await updateRSSSubscription({
        ...submitData,
        id: props.rssData.id
      } as UpdateRSSSubscriptionParams)
    } else {
      // 创建RSS订阅
      result = await createRSSSubscription(submitData as CreateRSSSubscriptionParams)
    }
    console.log(result)

    if (result.success) {
      message.success(result.message || '操作成功')
      emit('submit-success')
      show.value = false
    } else {
      message.error(result.message || '操作失败')
    }
  } catch (error) {
    console.log(error)
    message.error('表单验证失败或网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 取消表单
const handleCancel = () => {
  emit('cancel')
  show.value = false
  resetForm()
}

// 获取文件夹数据（支持分页加载全部）
const fetchFolders = async (parentFileId: number = 0): Promise<FolderCascaderOption[]> => {
  try {
    const allFolders: FolderCascaderOption[] = []
    let lastFileId: number | undefined = undefined
    
    // 循环获取所有分页数据
    do {
      const query: FileListQuery = {
        parentFileId,
        limit: 100, // 每页最大100个文件
        trashed: false,
        lastFileId
      }

      const result = await getFileList(query)

      // 检查result.data是否存在
      if (!result.data) {
        break
      }

      // 只筛选文件夹类型的数据 (type === 1)
      const folders = result.data.fileList
        .filter((item: FileInfo) => item.type === 1)
        .map((folder: FileInfo) => ({
          value: folder.fileId,
          label: folder.filename,
          isLeaf: false
        }))
      
      allFolders.push(...folders)
      
      // 更新lastFileId用于下一页查询
      lastFileId = result.data.lastFileId === -1 ? undefined : result.data.lastFileId
      
    } while (lastFileId !== undefined)
    
    return allFolders
  } catch (error) {
    console.error(error)
    message.error('获取文件夹列表失败，请稍后重试')
    return []
  }
}

// 级联选择器异步加载函数
const handleLoadFolders = async (option: CascaderOption) => {
  if (option.children) return

  loadingFolders.value = true
  try {
    // 根据选中的文件夹ID获取子文件夹（支持分页加载全部）
    const parentFileId = Number(option.value)
    const subFolders = await fetchFolders(parentFileId)
    if (subFolders.length){
      option.children = subFolders
    } else{
      option.isLeaf = true
    }
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
    folderOptions.value = await fetchFolders(0)
  } finally {
    loadingFolders.value = false
  }
}

// 处理文件夹路径变化
const handleFolderPathChange = (value: number | number[] | null, option: CascaderOption | CascaderOption[] | null, pathValues: any) => {
  if (option && !Array.isArray(option)) {
    formData.value.fatherFolderId = Number(option.value)
    formData.value.fatherFolderName = option.label!
  }
}
</script>