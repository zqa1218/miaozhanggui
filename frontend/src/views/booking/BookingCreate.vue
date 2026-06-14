<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookingStore } from '@/stores/booking'
import { useStudioStore } from '@/stores/studio'

const route = useRoute()
const router = useRouter()
const bookingStore = useBookingStore()
const studioStore = useStudioStore()

const selectedDate = ref('')
const form = ref({
  user_name: '',
  user_phone: '',
  pricing_type: 'single',
  total_amount: 0,
  remark: '',
})

const today = new Date().toISOString().slice(0, 10)

const availableDateSet = computed(() => {
  const dates = studioStore.current?.availableDates
  if (!dates || !Array.isArray(dates) || dates.length === 0) return null
  return new Set(dates)
})
const dateOutOfRange = computed(() => {
  if (!selectedDate.value || !availableDateSet.value) return false
  return !availableDateSet.value.has(selectedDate.value)
})

onMounted(async () => {
  await studioStore.fetchDetail(route.params.studioId)
  if (studioStore.current?.single_price) {
    form.value.total_amount = studioStore.current.single_price
  }
})

async function onDateChange() {
  if (!selectedDate.value) return
  if (dateOutOfRange.value) return
  await bookingStore.fetchAvailable(route.params.studioId, selectedDate.value)
}

function onPricingChange() {
  const s = studioStore.current
  form.value.total_amount = form.value.pricing_type === 'single'
    ? (s.single_price || 0)
    : (s.package_price || 0)
}

async function submit() {
  const studioId = parseInt(route.params.studioId)
  const slots = bookingStore.availableSlots.length > 0
    ? [{ date: selectedDate.value, start_time: bookingStore.availableSlots[0].start, end_time: bookingStore.availableSlots[0].end }]
    : []

  if (slots.length === 0) {
    alert('请选择可用时段')
    return
  }

  try {
    const order = await bookingStore.submitBooking({
      studio_id: studioId,
      ...form.value,
      slots,
    })
    alert('预约成功！订单号: ' + order.order_no)
    router.push('/studios')
  } catch (e) {
    alert(e.message || '预约失败')
  }
}
</script>

<template>
  <div class="booking-create fade-in-up">
    <h1>创建预约</h1>

    <div v-if="studioStore.current">
      <p>项目: {{ studioStore.current.name }}</p>
    </div>

    <label>
      预约日期
      <input type="date" v-model="selectedDate" :min="today" @change="onDateChange" />
    </label>
    <p v-if="dateOutOfRange" class="warn">该日期不在商家设定的可选范围内</p>
    <div v-if="availableDateSet" class="hint">
      可选日期: {{ studioStore.current?.availableDates?.join(', ') || '无' }}
    </div>

    <div v-if="bookingStore.availableSlots.length > 0">
      <h3>可用时段</h3>
      <div v-for="(slot, idx) in bookingStore.availableSlots" :key="idx" class="slot">
        {{ slot.start }} — {{ slot.end }}
      </div>
    </div>
    <p v-else-if="selectedDate">该日无可预约时段</p>

    <label>姓名 <input v-model="form.user_name" /></label>
    <label>手机号 <input v-model="form.user_phone" /></label>

    <label v-if="studioStore.current?.pricing_model !== 'single'">
      类型
      <select v-model="form.pricing_type" @change="onPricingChange">
        <option v-if="studioStore.current?.single_price" value="single">单张</option>
        <option v-if="studioStore.current?.package_price" value="package">套餐</option>
      </select>
    </label>

    <p>金额: ¥{{ form.total_amount }}</p>
    <label>备注 <textarea v-model="form.remark"></textarea></label>

    <button @click="submit">提交预约</button>
  </div>
</template>
