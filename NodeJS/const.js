/************************** ОБЪЯВЛЕНИЕ КОНСТАНТ ***************************/

// Версия протокола JSON-RPC
// https://www.jsonrpc.org/specification
module.exports.jsonRPCVersion = '2.0';

// Константы статуса ответа на запрос клиента 
module.exports.HTTP = {
  STATUS_OK: 200,
  STATUS_NOT_FOUND: 404,
  STATUS_METHOD_NOT_ALLOWED: 405,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  STATUS_ETH_GET_DATA_ERR: 599,
  STATUS_POSTGRES_ERR: 598,
  HEADER_CONTENT_TYPE: 'Content-Type',
  HEADER_CONTENT_LENGTH: 'Content-Length',
  HEADER_CACHE_CONTROL: 'Cache-Control',
}

module.exports.settings = {
  // Ключ для шифровки/расшифровки логина
  ENCRYPT_SECRET:    'значение_скрыто_при отгрузке_на_github',
  // Ключ для получения пароля шифрования закрытого ключа
  SCRYPT_SECRET:     'значение_скрыто_при отгрузке_на_github',
}
