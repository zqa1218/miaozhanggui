const config = require('../../config');
const localStorage = require('./local');

//   目前使用本地存储，后期可切换为 OSS / COS
const storage = localStorage;

module.exports = storage;
