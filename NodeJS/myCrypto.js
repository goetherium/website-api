/****************** Класс криптографической поддержки ********************************/
const consts = require('./const.js');
const crypto = require('crypto');
const algorithm = 'значение_скрыто_для_github';

class myCrypto {

constructor(pLogger) {
  this.logger = pLogger;
}

/* Генерит криптографически случайную строку 32 байта в бинарном формате.
 * Используется в качестве соли при создании пароля шифрования закрытого ключа.
 */
getSaltCallBack(callback) {
  crypto.randomBytes(32, (err, buf) => {
    if (err) {
      callback(err);
    }
    else {
      callback(null, buf);
      this.logger.logDebug(`Module crypto, method getSaltCallBack. ` + 
      `Получена соль: ${buf.toString('hex')}`);
    }
  });
}
// Промис-обёртка
async getSalt() {
  return await new Promise((resolve, reject) => {
    this.getSaltCallBack((err, buf) => {
      if (err) reject(err);
      else resolve(buf.toString('hex'));
    });
  })
}

/* ********** Получение пароля шифрования закрытого ключа ******************
 * Используем Scrypt вместо HMAC, т.к. он требователен к памяти,
 * а значит устойчивее к взлому
 * Возвращает 32-байтовую hex-строку, полученную в результате работы Scrypt.
 * При отгрузке на github скрыты некоторые детали.
 */
async getScryptPassword(params) {
  // Подмешиваем к данным пользователя секрет (64 hex).
  // В scrypt передаётся соль, она обеспечит уникальность
  // файлового пароля для разных аккаунтов пользователя.
  const scryptData = 'значение_скрыто_для_github';
  this.logger.logDebug('Module crypto, method getScryptPassword. ' + 
    `Данные для scrypt: ${scryptData}`);

  // Соль своя для разных аккаунтов одного пользователя
  const scryptPwd = await new Promise((resolve, reject) => {
    crypto.scrypt(scryptData, params.salt, 32, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  })

  this.logger.logDebug(`Module crypto, method getScryptPassword. Получен пароль: ${scryptPwd}`);
  return scryptPwd;
}  // getScryptPassword

/************************* Шифрование логина **********************************
 * Возвращает шифрованный логин в hex-формате
 * При отгрузке на github скрыты некоторые детали.
 */
getEncryptedLogin(pUserLogin) {
  const dataToEncrypt = pUserLogin;
  this.logger.logDebug('Module crypto, method getEncryptedLogin. ' + 
                       `Данные для шифрования: ${dataToEncrypt}`);

  const key = 'алгоритм_скрыт_для_github';
  const iv = 'алгоритм_скрыт_для_github';
  // Инициализируем шифровальщик
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  // Передаем шифруемые данные, на выходе - hex
  let encryptedData = cipher.update(dataToEncrypt, 'utf8', 'hex');
  encryptedData += cipher.final('hex');
  this.logger.logDebug('Module crypto, method getEncryptedLogin. ' + 
                       `Зашифрованные данные: ${encryptedData}`);
  return encryptedData;
}  // getEncryptedLogin


/************************* Расшифровка логина **********************************
 * pEncryptedLogin - зашифрованный логин пользователя в hex-формате
 */
getDecryptedLogin(pEncryptedLogin) {
  this.logger.logDebug('Module crypto, method getDecryptedLogin. ' + 
                       `Шифрованный логин ${pEncryptedLogin}`);

  // Используем тот же ключ, что и при шифровании
  const key = 'алгоритм_скрыт_для_github';
  // Используем тот же вектор  инициализации, что и при шифровании
  const iv = 'алгоритм_скрыт_для_github';
  // Инициализируем дешифровальщик
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  // Передаем данные для расшифровки в hex-формате
  let decryptedLogin = decipher.update(pEncryptedLogin, 'hex', 'utf8');
  // на выходе utf-данные
  decryptedLogin += decipher.final('utf8');
  this.logger.logDebug('Module crypto, method getDecryptedLogin. ' + 
                       `Расшифрованный логин: ${decryptedLogin}`);
  return decryptedLogin;
}  // getDecryptedLogin


}  // class

module.exports = myCrypto;
