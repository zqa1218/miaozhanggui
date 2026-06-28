import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useStudioCreateStore = defineStore('studioCreate', () => {
  const currentStep = ref(1)

  const step1 = reactive({
    title: '',
    city: '',
    availableDates: [],
    contactPhone: '',
    contactWechat: '',
    remark: '',
  })

  const step2 = reactive({
    baseStartTime: '09:00',
    baseEndTime: '21:00',
    intervalRestTime: 0,
    restSlots: [],
    isReplicated: true,
    isAllTimeOpen: false,
    selectedDates: [],
  })

  const step3 = reactive({
    isStyleEnabled: false,
    selectedStyleIds: [],
    singlePrice: 0,
    hasPackage: false,
    packagePrice: 0,
    singleShotTime: 5,
    packageTime: 30,
    isExperienceEnabled: false,
    noviceSingleAddTime: 20,
    novicePackageAddTime: 0,
    depositRatio: 30,
    addressRequired: false,
    extraItems: [],
  })

  function nextStep() { if (currentStep.value < 3) currentStep.value++ }
  function prevStep() { if (currentStep.value > 1) currentStep.value-- }

  function reset() {
    currentStep.value = 1
    Object.assign(step1, { title: '', city: '', availableDates: [], contactPhone: '', contactWechat: '', remark: '' })
    Object.assign(step2, { baseStartTime: '09:00', baseEndTime: '21:00', intervalRestTime: 0, restSlots: [], isReplicated: true, isAllTimeOpen: false, selectedDates: [] })
    Object.assign(step3, {
      isStyleEnabled: false, selectedStyleIds: [], singlePrice: 0, hasPackage: false, packagePrice: 0,
      singleShotTime: 5, packageTime: 30, isExperienceEnabled: false,
      noviceSingleAddTime: 20, novicePackageAddTime: 0, depositRatio: 30,
      addressRequired: false,
      extraItems: [],
    })
  }

  function buildPayload(mId) {
    return {
      mId,
      title: step1.title,
      city: step1.city,
      availableDates: step1.availableDates,
      isAllTimeOpen: step2.isAllTimeOpen,
      selectedDates: step2.isAllTimeOpen ? [] : step2.selectedDates,
      baseStartTime: step2.baseStartTime,
      baseEndTime: step2.baseEndTime,
      intervalRestTime: step2.intervalRestTime,
      restSlots: step2.restSlots.map(s => ({ start_time: s.startTime, end_time: s.endTime })),
      isReplicated: step2.isReplicated,
      isStyleEnabled: step3.isStyleEnabled,
      selectedStyleIds: step3.isStyleEnabled ? step3.selectedStyleIds : [],
      singlePrice: step3.isStyleEnabled ? undefined : step3.singlePrice,
      hasPackage: !step3.isStyleEnabled && step3.hasPackage,
      packagePrice: !step3.isStyleEnabled && step3.hasPackage ? step3.packagePrice : undefined,
      singleShotTime: step3.singleShotTime,
      packageTime: step3.packageTime,
      isExperienceEnabled: step3.isExperienceEnabled,
      noviceSingleAddTime: step3.noviceSingleAddTime,
      novicePackageAddTime: step3.novicePackageAddTime,
      depositRatio: step3.depositRatio,
      addressRequired: step3.addressRequired,
      extraItems: step3.extraItems.filter(e => e.name && e.name.trim()),
      contact_phone: step1.contactPhone,
      contact_wechat: step1.contactWechat,
      remark: step1.remark,
    }
  }

  return { currentStep, step1, step2, step3, nextStep, prevStep, reset, buildPayload }
})
