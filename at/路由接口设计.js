// 1. C端：高精度时段占用及不可接单网格拉取
// 请求：GET /api/booked-times-v2?studioId=1&date=2026-06-06&mId=shop_xxx
// 响应：{ success: true, data: { intervals: [{start: "09:00", end: "10:30", lockType: "hard_lock"}], restSlots: [{start: "12:00", end: "13:30"}] } }
router.get('/booked-times-v2', async (req, res) => {
    const { studioId, date, mId } = req.query;
    const booked = await knex('slot_bookings').where({ studio_id: studioId, booking_date: date, m_id: mId });
    const rests = await knex('studio_rest_slots').where({ studio_id: studioId });
    res.json({
        success: true,
        data: {
            intervals: booked.map(b => ({ start: b.start_time, end: b.end_time, lockType: b.lock_type, orderNo: b.order_no })),
            restSlots: rests.map(r => ({ start: r.start_time, end: r.end_time }))
        }
    });
});

// 2. C端：付定金后发起第一重锁定 (软锁)
// 请求：POST /api/pay-deposit 载荷：{ orderNo: "MG123", mId: "shop_xxx" }
router.post('/pay-deposit', async (req, res) => {
    const { orderNo, mId } = req.body;
    await knex.transaction(async (trx) => {
        const order = await trx('orders').where({ order_no: orderNo, m_id: mId }).first().forUpdate();
        if (order.status !== '待支付') throw new Error('订单状态不符');
        
        // 执行高精度二次碰撞校验，防止事务幻读并发
        const isConflict = await checkCollisionV2(trx, order);
        if (isConflict) return res.json({ success: false, message: '该精算时段已被他人抢占，定金已被拦截退回' });
        
        await trx('slot_bookings').insert({
            m_id: mId, studio_id: order.studio_id, order_no: orderNo,
            booking_date: order.order_date, start_time: order.booking_start_time,
            end_time: order.booking_end_time, lock_type: 'pre_lock'
        });
        await trx('orders').where({ order_no: orderNo }).update({ status: '已付定金' });
    });
    res.json({ success: true, message: '定金锁定成功' });
});

// 3. B端：摄影师在后台确认单据，发起第二重彻底锁定 (硬锁)
// 请求：POST /api/order/confirm-lock 载荷：{ orderNo: "MG123", mId: "shop_xxx" }
router.post('/order/confirm-lock', async (req, res) => {
    const { orderNo, mId } = req.body;
    await knex.transaction(async (trx) => {
        await trx('slot_bookings').where({ order_no: orderNo, m_id: mId }).update({ lock_type: 'hard_lock' });
        await trx('orders').where({ order_no: orderNo }).update({ status: '已确认锁定' });
    });
    res.json({ success: true, message: '时间轴硬锁完成，已归入正式工作流' });
});