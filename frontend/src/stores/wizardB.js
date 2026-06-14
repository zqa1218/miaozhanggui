import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { normalizeExtraItemsForSubmit } from '@/utils/extraItems'

/**
 * B端项目创建向导 — 跨3步窗口的数据总线
 */
export const useWizardBStore = defineStore('wizardB', () => {

  // ============ Step1 产出 ============
  const title       = ref('')
  const description = ref('')
  const city        = ref('')
  const coverUrl    = ref('')
  const detailImgUrls = ref([])
  const selectedDates = ref([])
  const isAllTimeOpen = ref(false)

  // ============ Step2 产出 ============
  const dailyHours   = ref({})        // { "YYYY-MM-DD": { open, close } }
  const baseStartTime = ref('09:00')
  const baseEndTime   = ref('18:00')
  const restSlots     = ref([])       // [{ start_time, end_time, day_of_week, reason }]
  const intervalRestTime = ref(15)

  // ============ Step3 产出 ============
  const isStyleEnabled    = ref(false)
  const selectedStyleIds  = ref([])
  const isExperienceEnabled = ref(false)
  const noviceSingleAddTime = ref(20)
  const hasPackage        = ref(false)
  const pricingModel      = ref('single')   // 'single' | 'package' | 'both'
  const singlePrice       = ref(0)
  const packagePrice      = ref(0)
  const packageSessionCount = ref(1)
  const singleShotTime    = ref(5)
  const packageTime       = ref(30)
  const depositRatio      = ref(30)
  const extraItems        = ref([])

  // ============ buildPayload — 字段名严格对齐后端 validator ============
  const buildPayload = computed(() => {
    const payload = {
      mId: '', // 由调用方注入
      title: title.value,
      description: description.value,
      city: city.value,
      coverUrl: coverUrl.value || undefined,
      detailImgUrls: detailImgUrls.value.length > 0 ? detailImgUrls.value : undefined,
      availableDates: selectedDates.value,
      isAllTimeOpen: isAllTimeOpen.value,

      baseStartTime: baseStartTime.value,
      baseEndTime: baseEndTime.value,
      intervalRestTime: intervalRestTime.value,
      restSlots: restSlots.value,

      isStyleEnabled: isStyleEnabled.value,
      isExperienceEnabled: isExperienceEnabled.value,
      noviceSingleAddTime: noviceSingleAddTime.value,
      hasPackage: hasPackage.value,
      depositRatio: depositRatio.value,
      singleShotTime: singleShotTime.value,
      extraItems: normalizeExtraItemsForSubmit(extraItems.value),
    }

    if (isStyleEnabled.value) {
      payload.selectedStyleIds = selectedStyleIds.value
    } else {
      payload.pricingModel = pricingModel.value
      const model = pricingModel.value
      payload.singlePrice = (model === 'single' || model === 'both') ? singlePrice.value : null
      payload.hasPackage = (model === 'package' || model === 'both')
      if (payload.hasPackage) {
        payload.packagePrice = packagePrice.value
        payload.packageSessionCount = packageSessionCount.value
        payload.packageTime = packageTime.value
      }
    }

    return payload
  })

  const step1Valid = computed(() => {
    return title.value.trim().length > 0 && (isAllTimeOpen.value || selectedDates.value.length > 0)
  })

  const step2Valid = computed(() => {
    return selectedDates.value.length > 0
  })

  const step3Valid = computed(() => {
    if (isStyleEnabled.value) {
      return selectedStyleIds.value.length > 0
    }
    const model = pricingModel.value
    if ((model === 'single' || model === 'both') && (!singlePrice.value || singlePrice.value <= 0)) return false
    if ((model === 'package' || model === 'both') && (!packagePrice.value || packagePrice.value <= 0)) return false
    return true
  })

  function resetAll() {
    title.value = ''; description.value = ''; city.value = ''; coverUrl.value = ''
    detailImgUrls.value = []; selectedDates.value = []; isAllTimeOpen.value = false; dailyHours.value = {}
    baseStartTime.value = '09:00'; baseEndTime.value = '18:00'
    restSlots.value = []; intervalRestTime.value = 15
    isStyleEnabled.value = false; selectedStyleIds.value = []
    isExperienceEnabled.value = false; noviceSingleAddTime.value = 20
    hasPackage.value = false
    pricingModel.value = 'single'; singlePrice.value = 0; packagePrice.value = 0
    packageSessionCount.value = 1; singleShotTime.value = 5; packageTime.value = 30
    depositRatio.value = 30; extraItems.value = []
  }

  return {
    title, description, city, coverUrl, detailImgUrls, selectedDates, isAllTimeOpen,
    dailyHours, baseStartTime, baseEndTime, restSlots, intervalRestTime,
    isStyleEnabled, selectedStyleIds,
    isExperienceEnabled, noviceSingleAddTime,
    hasPackage, pricingModel, singlePrice, packagePrice, packageSessionCount,
    singleShotTime, packageTime, depositRatio, extraItems,
    buildPayload, step1Valid, step2Valid, step3Valid, resetAll,
  }
})
