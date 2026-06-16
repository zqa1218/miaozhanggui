const config = require('../../config');

const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: 'utf8mb4',
  },
  pool: {
    min: config.env === 'production' ? 5 : 2,
    max: config.env === 'production' ? 30 : 10,
  },
  //  开发环境打印 SQL
  debug: config.env === 'development',
});

module.exports = knex;
