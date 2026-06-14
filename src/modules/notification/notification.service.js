const repo = require('./notification.repository');

async function getList(mId) {
  const rows = await repo.findByMerchant(mId);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    type: r.type,
    orderNo: r.order_no,
    isRead: r.is_read,
    createdAt: r.created_at,
  }));
}

async function getUnreadCount(mId) {
  const result = await repo.countUnread(mId);
  return { count: result?.count || 0 };
}

async function markAsRead(mId, ids) {
  await repo.markAsRead(mId, ids);
  return { success: true };
}

const orderRepo = require('../order/order.repository');

async function getUserNotifications(mId, deviceId) {
  const orders = await orderRepo.findByDevice(mId, deviceId);
  const orderNos = orders.map((o) => o.order_no);
  if (orderNos.length === 0) return [];
  const rows = await repo.findByOrderNos(mId, orderNos);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    type: r.type,
    orderNo: r.order_no,
    isRead: r.is_read,
    createdAt: r.created_at,
  }));
}

module.exports = { getList, getUnreadCount, markAsRead, getUserNotifications };
