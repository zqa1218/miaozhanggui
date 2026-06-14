const repo = require('./log.repository');

async function getList(mId) {
  const rows = await repo.findByMerchant(mId);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.created_at,
  }));
}

async function addLog(mId, action) {
  await repo.insert({ m_id: mId, action });
  return { success: true };
}

async function clearLogs(mId) {
  await repo.clearByMerchant(mId);
  return { success: true };
}

module.exports = { getList, addLog, clearLogs };
