import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * C端用户下单向导 — 跨2步窗口的数据总线
 */
export const useWizardCStore = defineStore('wizardC', () => {

  // ============ Step1 产出 ============
  const studioId       = ref(null)
  const bookingDate    = ref('')
  const pricingType    = ref('single')    // 'single' | 'package'
  const quantity       = ref(1)
  const isNewCustomer  = ref(false)
  const startTime      = ref('')          // "HH:mm"
  const computedEndTime   = ref('')
  const computedTotalMin  = ref(0)
  const computedPrice     = ref(0)

  // 样式 + 套餐关联
  const selectedStyleId   = ref(null)
  const selectedPackageId = ref(null)
  const styleName         = ref('')
  const packageFixedDuration = ref(0)

  // 附加项目
  const selectedAddonIds  = ref([])
  const addonTotal        = ref(0)
  const selectedExtraItems = ref([])  // 完整附加项目详情，供 step2 提交

  // 角色信息
  const roleName = ref('')
  const modelExperience = ref('experienced')
  const depositRatio = ref(30)

  // ============ Step2 产出 ============
  const contactType = ref('')     // 'qq' | 'wechat' | 'phone' | 'other'
  const contactValue = ref('')
  const contactNote = ref('')

  // 锁状态跟踪
  const lockStatus = ref('')   // '' | 'pre_lock' | 'hard_lock'

  // 提交结果
  const orderResult = ref(null)

  // ============ 计算 ============

  const step1Valid = computed(() => {
    return !!bookingDate.value && !!startTime.value && quantity.value > 0
  })

  /** 校验角色名 + 联系方式均非空 */
  const step2Valid = computed(() => {
    return roleName.value.trim().length > 0 && contactType.value && contactValue.value.trim().length > 0
  })

  function setStep1({ studioId: sid, bookingDate: bd, pricingType: pt, quantity: qty,
    isNewCustomer: inc, startTime: st, endTime: et, totalMin: tm, displayMin: dm, price: p,
    selectedStyleId: ssid, selectedPackageId: spid, styleName: sn, modelExperience: me, depositRatio: dr,
    packageFixedDuration: pfd, selectedAddonIds: saids, addonTotal: at, selectedExtraItems: seis }) {
    studioId.value      = sid
    bookingDate.value   = bd
    pricingType.value   = pt
    quantity.value      = qty
    isNewCustomer.value = inc
    startTime.value     = st
    // 展示用：仅纯拍摄时间（不含休息）
    computedEndTime.value  = et
    computedTotalMin.value = dm || tm
    computedPrice.value    = p
    selectedStyleId.value    = ssid || null
    selectedPackageId.value  = spid || null
    styleName.value          = sn || ''
    modelExperience.value    = me || 'experienced'
    packageFixedDuration.value = pfd || 0
    selectedAddonIds.value   = saids || []
    addonTotal.value         = at || 0
    selectedExtraItems.value = seis || []
    if (dr) depositRatio.value = dr
  }

  function setOrderResult(data) {
    orderResult.value = data
  }

  function setLockStatus(status) {
    lockStatus.value = status
  }

  function resetAll() {
    studioId.value = null; bookingDate.value = ''; pricingType.value = 'single'
    quantity.value = 1; isNewCustomer.value = false; startTime.value = ''
    computedEndTime.value = ''; computedTotalMin.value = 0; computedPrice.value = 0
    selectedStyleId.value = null; selectedPackageId.value = null
    styleName.value = ''; packageFixedDuration.value = 0
    selectedAddonIds.value = []; addonTotal.value = 0; selectedExtraItems.value = []
    roleName.value = ''; modelExperience.value = 'experienced'
    contactType.value = ''; contactValue.value = ''; contactNote.value = ''
    lockStatus.value = ''; orderResult.value = null
  }

  return {
    studioId, bookingDate, pricingType, quantity, isNewCustomer, startTime,
    computedEndTime, computedTotalMin, computedPrice,
    selectedStyleId, selectedPackageId, styleName, packageFixedDuration,
    selectedAddonIds, addonTotal, selectedExtraItems,
    roleName, modelExperience, depositRatio, lockStatus,
    contactType, contactValue, contactNote, orderResult,
    step1Valid, step2Valid,
    setStep1, setOrderResult, setLockStatus, resetAll,
  }
})
