require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'studio_booking',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    timezone: '+08:00',
  },

  slot: {
    lockTimeoutMinutes: parseInt(process.env.SLOT_LOCK_TIMEOUT_MINUTES, 10) || 15,
  },
};
