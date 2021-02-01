/****************** Класс обработчиков клиентских запросов ********************************/
const consts = require('./const.js');
const Crypto = require('./myCrypto.js');

// hex-префикс
const hexPrefix = '0x';

class reqHandler {

constructor(pLogger, pDebugLevel, pEth, pPG) {
  this.logger     = pLogger;
  this.debugLevel = pDebugLevel;
  this.eth        = pEth;
  this.pg         = pPG;
  this.crypto     = new Crypto(pLogger);
}

// Возвращает успешный результат в формате JSON-RPC
// https://www.jsonrpc.org/specification#response_object
getJsonRPCSuccess(result, requestId) {
  let nRequestId;
  let jsonMsg;

  if (requestId) {
    nRequestId = requestId;
  }
  else {
    nRequestId = null;
  }

  if (typeof result === 'string') {
     jsonMsg = `{"jsonrpc":"${consts.jsonRPCVersion}","id":${nRequestId},` + 
         `"result":"${result}"}`;
  }
  else if (typeof result === 'object') {
     jsonMsg = `{"jsonrpc":"${consts.jsonRPCVersion}","id":${nRequestId},` + 
         `"result":${JSON.stringify(result)}}`;
  }
  else {
    jsonMsg = `{"jsonrpc":"${consts.jsonRPCVersion}","id":${nRequestId},` + 
        `"result":${result}}`;
  }
  
  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug(`Module reqHandler, method getJsonRPCSuccess. ` + 
       `Response: ${jsonMsg}`);
  }
  return jsonMsg;
}

// Возвращает ошибку в формате JSON-RPC
// https://www.jsonrpc.org/specification#response_object
getJsonRPCError(errCode, errMsg, requestId, errData) {
  let nRequestId;
  if (requestId) {
    nRequestId = requestId;
  }
  else {
    nRequestId = null;
  }
  const jsonMsg = 
     `{"jsonrpc":"${consts.jsonRPCVersion}","id":${nRequestId},` +
     `"error":{"code":${errCode},"message":"${errMsg}"}}`;

  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug(`Module reqHandler, method getJsonRPCError. Response: ${jsonMsg}`);
  }
  return jsonMsg;     
}




/**************************** МЕТОД handleUserAdd ********************************
 * Добавляет пользователя в БД.
 * Логин сохраняется в PostgreSQL зашифрованным, а не хешируемым, 
 * чтобы выдавать сайту список транзакций с указанием открытого логина.
 * Входные параметры:
 *   realm - строка: реалм пользователей, обязательный параметр
 *   userLogin - строка: открытый логин пользователя внутри реалма, обязательный параметр
 * Возвращает:
 * строку «Пользователь добавлен» в случае успешного добавления пользователя.
 * ошибку с кодом -2001, если пользователь уже существует в БД.
 * ошибку с кодом -1001 при ошибке добавления в БД и текстом ошибки.
 */
async handleUserAdd(response, params, requestId) 
{
  this.logger.logDebug('Module reqHandler, method handleUserAdd. ' + 
                       `Реалм ${params.realm}, логин ${params.userLogin}`);

  try {
    if ( (!params.realm) || (!params.userLogin) ) {
      throw new Error('Не заданы входные параметры');
    }

    // Шифруем логин
    const encryptedLogin = this.crypto.getEncryptedLogin(params.userLogin);
    // Записываем пользователя в БД
    const userObj = await this.pg.userAdd(params.realm, encryptedLogin);
    if (userObj) {
      response.writeHead(consts.HTTP.STATUS_OK);
      response.end(this.getJsonRPCSuccess(userObj, requestId));      
      this.logger.logDebug('Module reqHandler, method handleUserAdd. Пользователь добавлен в БД');
    }
    else {
      response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error adding the user');
      response.end(this.getJsonRPCError(-2001, 'Пользователь уже существует', requestId));      
      this.logger.logDebug('Module reqHandler, method handleUserAdd. Пользователь уже существует в БД');
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleUserAdd. ' + 
        'Error calling pgData.userAdd: ', err);
    response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error adding the user');
    response.end(this.getJsonRPCError(-1001, err.message, requestId));      
  }
}  // handleUserAdd


/**************************** МЕТОД handleUserGet ********************************
 * Проверка существования пользователя в БД
 * Входные параметры:
 *   realm - строка: реалм пользователей
 *   userLogin – строка: логин пользователя внутри реалма.
 * Возвращает:
 *   createdDate – дата создания
 * Ошибку с кодом -2002, если пользователь не найден
 * Ошибку с кодом -1005 при ошибке и текстом ошибки.
 */
async handleUserGet(response, params, requestId) {
  this.logger.logDebug('Module reqHandler, method handleUserGet. ' + 
    `Реалм ${params.realm}, логин ${params.userLogin}`);

  try {
    if ( (!params.realm) || (!params.userLogin) ) {
      throw new Error('Не заданы входные параметры');
    }
 
    // Шифруем логин
    const encryptedLogin = this.crypto.getEncryptedLogin(params.userLogin);
    // Получаем данные пользователя
    const user = await this.pg.userGetByLogin(params.realm, encryptedLogin);
    if (user) {
      response.writeHead(consts.HTTP.STATUS_OK);
      // результат нужно вернуть в виде объекта для выдачи верного JSON
      const resObj = {createdDate: user.createdDate};
      response.end(this.getJsonRPCSuccess(resObj, requestId));
    }
    else {
      response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error getting user');
      response.end(this.getJsonRPCError(-2002, 'Пользователь не найден', requestId));      
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleUserGet ' + 
        'Error calling pgData.userGetByLogin: ', err);
    response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error getting user');
    response.end(this.getJsonRPCError(-1005, err.message, requestId));      
  }
}  // handleUserGet


/**************************** МЕТОД handleAccountAdd ********************************
 * Добавляет аккаунт пользователя в БД.
 * Логин сохраняется в PostgreSQL зашифрованным.
 * Входные параметры:
 *   params - объект со свойствами:
 *     realm - строка: реалм пользователей, обязательный параметр
 *     userLogin - строка: логин пользователя во внешней системе, обязательный параметр
 *     accountName - строка: пользовательское название аккаунта, обязательный параметр
 *     accountPassword - строка: промежуточный hmac, используемый для получения пароля
 *       шифрования закрытого ключа при создании аккаунта.
 * Возвращает:
 *   - address 20 байт: адрес в hex-формате (с префиксом 0x) созданного аккаунта
 *   - ошибку с кодом -2001, если аккаунт уже существует в БД.
 *   - ошибку с кодом -1002 при ошибке добавления в БД и текстом ошибки.
 *
 * Для сохранения в БД используется адрес аккаунта
 */
async handleAccountAdd(response, params, requestId) {
  // определяем здесь для очистки в finally
  let account;            // аккаунт Ethereum
  let scryptParams = {};  // объект для получения пароля шифрования закрытого ключа
  let keystorePwd;        // пароль шифрования ключа

  try {
    if ( (!params.userLogin) || (!params.realm) ||
         (!params.accountName)  || (!params.accountPassword) ) 
    {
      throw new Error('Не заданы входные параметры');
    }

    this.logger.logDebug('Module reqHandler, method handleAccountAdd. Вх.параметры:' + 
      `реалм ${params.realm}, логин ${params.userLogin}, ` + 
      `имя аккаунта ${params.accountName}, пароль ${params.accountPassword}`);

    // Получим объект: address, privateKey
    // address с контролем - часть символов в верхнем регистре, часть в нижнем
    account = this.eth.accountCreate();
    this.logger.logDebug('Module reqHandler, method handleAccountAdd. ' + 
       `Сгенерирован web3 аккаунт с адресом ${account.address}`);

    // Шифруем логин
    const encryptedLogin = this.crypto.getEncryptedLogin(params.userLogin);
    // получаем данные пользователя
    const user = await this.pg.userGetByLogin(params.realm, encryptedLogin);
    if (!user) {
      throw new Error(`Пользователь для реалма ${params.realm} и логина ${params.userLogin} не найден`);
    }

    /***** Заполним объект для получения пароля шифрования закрытого ключа *****/
    /* Алгоритм заполнения объекта scryptParams скрыт для github */
    scryptParams.salt = await this.crypto.getSalt();
    this.logger.logDebug('Module reqHandler, method handleAccountAdd. ' + 
      'Заполнен объект для получения пароля шифрования закрытого ключа');
    // Получаем пароль шифрования закрытого ключа
    keystorePwd = await this.crypto.getScryptPassword(scryptParams);

    // Получим структуру с зашифрованным файлом закрытого ключа
    const encryptedKey = this.eth.accountEncrypt(account.privateKey, keystorePwd);
    if (this.debugLevel === 'Debug' ) {
      this.logger.logDebug('Module reqHandler, method handleAccountAdd. ' + 
      `Получено зашифрованное хранилище: ${JSON.stringify(encryptedKey)}`);
    }

    // Добавляем аккаунт и шифрованный ключ в БД
    const resObj = await this.pg.accountAdd(user.userId
                                          , account.address.slice(2)  // удаляем префикс 0x
                                          , params.accountName
                                          , encryptedKey
                                          , scryptParams.salt
                                        );

    if (resObj) {
      resObj.address = account.address;  // добавим адрес с префиксом 0x
      response.writeHead(consts.HTTP.STATUS_OK);
      response.end(this.getJsonRPCSuccess(resObj, requestId));      
      this.logger.logDebug('Module reqHandler, method handleAccountAdd. ' + 
         'Аккаунт успешно добавлен в БД');
    }
    else {
      response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error adding the account');
      response.end(this.getJsonRPCError(-2001, 'Аккаунт уже существует', requestId));
      this.logger.logDebug('Module reqHandler, method handleAccountAdd. ' + 
         'Аккаунт уже существует в БД');
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleAccountAdd. ' + 
        'Error calling pgData.accountAdd: ', err);
    response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error adding the account');
    response.end(this.getJsonRPCError(-1002, err.message, requestId));      
  }
  finally {
    // очищаем в памяти закрытый ключ и пароль
    params.accountPassword = null;
    account = null;
    scryptParams = null;
    keystorePwd = null;
  }
}  // handleAccountAdd

/**************************** МЕТОД handleAccountGetList ********************************
 * Получение списка аккаунтов пользователя из БД Postgres.
 * Структура params:
 *   realm - строка: реалм пользователей
 *   userLogin – строка: логин пользователя в приложении.
 * Возвращает:
 * Массив, в котором каждая запись имеет атрибуты:
 *   accountAddress – адрес аккаунта в блокчейне
 *   accountName – пользовательское наименование для сайта
 *   balance - баланс аккаунта
 *   createdDate – дата создания
 * Ошибку с кодом -2002, если аккаунтов нет в БД.
 * Ошибку с кодом -1004 при ошибке и текстом ошибки.
 */
async handleAccountGetList(response, params, requestId) {
  this.logger.logDebug('Module reqHandler, method handleAccountGetList. ' + 
      `Реалм ${params.realm}, логин ${params.userLogin}`);
  try {
    if ( (!params.realm) || (!params.userLogin) ) {
      throw new Error('Не заданы входные параметры');
    }

    // Шифруем логин
    const encryptedLogin = this.crypto.getEncryptedLogin(params.userLogin);
    // получаем данные пользователя
    const user = await this.pg.userGetByLogin(params.realm, encryptedLogin);
    if (!user) {
      throw new Error(`Пользователь для реалма ${params.realm} и логина ${params.userLogin} не найден`);
    }
    // получаем список аккаунтов
    const accountArr = await this.pg.accountGetList(user.userId);
    if (accountArr) {
      // добавляем баланс для каждого аккаунта
      this.logger.logDebug('Module reqHandler, method handleAccountGetList. ' + 
        'Добавляем баланс для каждого аккаунта');
      for (let i = 0; i < accountArr.length; i++) {
        accountArr[i].balance = await this.eth.accountGetBalance(accountArr[i].accountAddress);
        this.logger.logDebug('Module reqHandler, method handleAccountGetList. ' + 
          `Получен баланс адреса ${accountArr[i].accountAddress}: ${accountArr[i].balance} эфиров`);
      }
      response.writeHead(consts.HTTP.STATUS_OK);
      response.end(this.getJsonRPCSuccess(accountArr, requestId));
    }
    else {
      response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error getting list of accounts');
      response.end(this.getJsonRPCError(-2002, 'Аккаунт не найден', requestId));
      this.logger.logDebug('Module reqHandler, method handleAccountGetList. ' + 
        'Аккаунты не найдены в БД');
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleAccountGetList ' + 
        'Error calling pgData.accountsGet: ', err);
    response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error getting list of accounts');
    response.end(this.getJsonRPCError(-1004, err.message, requestId));      
  }
}  // handleAccountGetList



/**************************** МЕТОД handleTxSend ********************************
 * Подписывает транзакцию, отправляет её в сеть и добавляет в БД
 * Входные параметры структуры params
 *   accountAddress - адрес аккаунта (отправителя) в hex-формате
 *   destinationAddress - адрес получателя в hex-формате
 *   etherValue - сумма транзакции в эфирах (необязательный параметр)
 *   accountPassword - промежуточный пароль шифрования закрытого ключа.
 *     В качестве такого пароля сайт передаёт hmac-хеш,
 *     полученный на основе данных пользователя
 * Возвращает:
 *   объект с атрибутами
 *   - txHash – 64 байт хеша отправленной транзакции в hex-формате
 *   - blockNumber - номер блока, в которую включена транзакция
 *   - contractAddress - адрес созданного контракта, если адрес получателя не был указан
 * ошибку с кодом -2001, если транзакция уже существует в БД
 * ошибку с кодом -1003 при ошибке отправки транзакции.
 */
async handleTxSend(response, params, requestId) {
  // определяем здесь для очистки в finally
  let keystore;         // зашифрованный ключ и соль
  let privateKey;       // закрытй ключ
  let scryptParams = {};  // объект для получения пароля шифрования закрытого ключа
  let keystorePwd;      // пароль шифрования закрытого ключа

  try {
    if ( (!params.accountAddress) || (!params.destinationAddress) ||
         (!params.accountPassword) )
    {
      throw new Error('Не заданы входные параметры');
    }

    // извлекаем зашифрованный файл с закрытым ключом и соль,
    // из адреса удаляем префикс 0x
    keystore = await this.pg.keystoreGet(params.accountAddress.slice(2));
    this.logger.logDebug('Module reqHandler, method handleTxSend. Из БД получено файловое хранилище');

    const user = await this.pg.userGetByAddress(params.accountAddress.slice(2));
    // получаем ключ дешифровки, описание см. myCrypto.js
    /* Алгоритм заполнения объекта scryptParams скрыт для github */
    scryptParams.salt = keystore.salt;    
    keystorePwd = await this.crypto.getScryptPassword(scryptParams);

    // получаем расшифрованный закрытый ключ
    privateKey = this.eth.accountDecrypt(keystore.encrypted_key, keystorePwd);
    this.logger.logDebug('Module reqHandler, method handleTxSend. Закрытый ключ расшифрован');
    
    // подписываем транзакцию
    const rawTransaction = await this.eth.signTransaction(
        params.destinationAddress
      , params.etherValue
      , privateKey
      );
    this.logger.logDebug('Module reqHandler, method handleTxSend. Транзакция подписана');
    
    // отправляем транзакцию
    const txReceipt = await this.eth.sendSignedTransaction(rawTransaction);
    this.logger.logDebug('Module reqHandler, method handleTxSend. Транзакция включена в блок');

    // если это была Тх создания контракта, адрес берём из Тх
    let destAddress;
    if (txReceipt.contractAddress) {
      destAddress = txReceipt.contractAddress;
    }
    else {
      destAddress = params.destinationAddress;
    }
    // сохраняем транзакцию в БД
    const weiValue = this.eth.utilFromEtherToWei(params.etherValue);
    const txObj = await this.pg.txAdd(txReceipt.txHash.slice(2)
                                    , params.accountAddress.slice(2)
                                    , destAddress.slice(2)
                                    , weiValue);
    if (txObj) {
      response.writeHead(consts.HTTP.STATUS_OK);
      response.end(this.getJsonRPCSuccess(txReceipt, requestId));      
      this.logger.logDebug('Module reqHandler, method handleTxSend. Транзакция сохранена в БД');
    }
    else {
      response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error adding the transaction');
      response.end(this.getJsonRPCError(-2001, 'Транзакция уже существует в БД', requestId));      
      this.logger.logDebug('Module reqHandler, method handleTxSend. Транзакция уже есть в БД');
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleTxSend. ' + 
        'Error sending transaction: ', err);
    response.writeHead(consts.HTTP.STATUS_ETH_GET_DATA_ERR, 'Error sending transaction');
    response.end(this.getJsonRPCError(-1003, err.message, requestId));      
  }
  finally {
    // очищаем в памяти закрытый ключ и пароли
    privateKey = null;
    params.accountPassword  = null;
    keystore = null;
    scryptParams = null;
    keystorePwd = null;
  }
}  // handleTxSend

/**************************** МЕТОД handleTxGetList ********************************
 * Получение исходящих/входящих транзакций из БД
 * Входные параметры:
 *   direction - строка: Out - транзакции, сделанные с аккаунта
 *                       In - входящие на аккаунта транзакции
 *   accountAddress – hex-строка: адрес аккаунта пользователя
 *   dateFrom - дата в JSON-формате: начальная дата транзакций.
 *              Если не указана, то неделя от текущей даты
 *   dateTo - дата в JSON-формате: конечная дата транзакций
 *            Если не указана, то текущая дата
 *   pSortOrder - направление сортировки:
 *     Asc - сначала старые транзакции
 *     Desc - сначала новые транзакции
 *     NoSort - без сортировки (по умолчанию)
* Возвращает вложенный массив, каждый элемент имеет состав:
 *   txHash - hex-строка: хеш транзакции
 *   sourceAddress - hex-строка: адрес отправителя
 *   destAddress - hex-строка: адрес получателя
 *   createdDate - дата в JSON-формате: дата транзакции
 * Ошибку с кодом -2002, если транзакций не найдено
 * Ошибку с кодом -1006 при ошибке и текстом ошибки.
 */
async handleTxGetList(response, params, requestId)
{
  this.logger.logDebug(`Module reqHandler, method handleTxGetList. ` + 
    `accountAddress ${params.accountAddress}, direction ${params.direction} ` + 
    `dateFrom ${params.dateFrom}, dateTo ${params.dateTo}`);

  try {
    if ( (!params.direction) || (!params.accountAddress) ) {
      throw new Error('Не заданы входные параметры');
    }
    if (! (params.direction == 'Out' || params.direction == 'In') ) {
      throw new Error('Параметр direction может принимать значения Out или In');
    }
  
    // получаем список транзакций в виде массива объектов
    const arrTx = await this.pg.txGetList(params.direction
                                        , params.accountAddress.slice(2)
                                        , params.dateFrom
                                        , params.dateTo
                                        , params.sortOrder);

    // добавляем логины отправителя и получателя
    if (arrTx) {
      let sourceDecryptedLogin;
      let destDecryptedLogin;
      for (let i = 0; i < arrTx.length; i++) {
        if (params.direction=='Out') {
          // отправителя дешифруем только один раз
          if (i == 0 && arrTx[i].sourceUserLogin) {
            sourceDecryptedLogin = this.crypto.getDecryptedLogin(arrTx[i].sourceUserLogin);
          }
          arrTx[i].sourceUserLogin = sourceDecryptedLogin;
          if (arrTx[i].destUserLogin) {
            arrTx[i].destUserLogin = this.crypto.getDecryptedLogin(arrTx[i].destUserLogin);
          }
        }
        else if (params.direction=='In') {
          if (arrTx[i].sourceUserLogin) {
            arrTx[i].sourceUserLogin = this.crypto.getDecryptedLogin(arrTx[i].sourceUserLogin);
          }
          // получателя дешифруем только один раз
          if (i == 0 && arrTx[i].destUserLogin) {
            destDecryptedLogin = this.crypto.getDecryptedLogin(arrTx[i].destUserLogin);
          }
          arrTx[i].destUserLogin = destDecryptedLogin;
        }
        
        // переводим wei в эфиры
        arrTx[i].etherValue = this.eth.utilFromWeiToEther(arrTx[i].weiValue);
      }

      this.logger.logDebug('Module reqHandler, method handleTxGetList. Finish');
      response.writeHead(consts.HTTP.STATUS_OK);
      response.end(this.getJsonRPCSuccess(arrTx, requestId));
    }
    else {
      response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error getting transaction list');
      response.end(this.getJsonRPCError(-2002, 'Транзакций не найдено', requestId));      
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleTxGetList ' + 
        'Error getting transaction list: ', err);
    response.writeHead(consts.HTTP.STATUS_POSTGRES_ERR, 'Error getting transaction list');
    response.end(this.getJsonRPCError(-1006, err.message, requestId));      
  }
}  // handleTxGetList

/**************************** МЕТОД handleTxGet ********************************
 * Возвращает из блокчейна детали транзакции.
 */
async handleTxGet(response, params, requestId) {
  try {
    if (!params.txHash) {
      throw new Error('Не задан хеш транзакции');
    }
    const txObj = await this.eth.getTransaction(params.txHash);
    if (txObj) {
      this.logger.logDebug('Module reqHandler, method handleTxGet. Получены детали транзакции');

      // добавляем логины отправителя и получателя (может отсутствовать в БД)
      let userObj = {};
      let decryptedLogin;
      if (txObj.from) {
        // получим шифрованный логин из БД
        userObj = await this.pg.userGetByAddress(txObj.from.slice(2));
        // дешифруем логин
        decryptedLogin = this.crypto.getDecryptedLogin(userObj.userLogin);
        if (decryptedLogin) txObj.sourceUserLogin = decryptedLogin;
      }
      if (txObj.to) {
        userObj = await this.pg.userGetByAddress(txObj.to.slice(2));
        decryptedLogin = this.crypto.getDecryptedLogin(userObj.userLogin);
        if (decryptedLogin) txObj.destUserLogin = decryptedLogin;
      }

      response.writeHead(consts.HTTP.STATUS_OK);
      response.end(this.getJsonRPCSuccess(txObj, requestId));
    }
    else {
      response.writeHead(consts.HTTP.STATUS_ETH_GET_DATA_ERR, 'Error getting transaction');
      response.end(this.getJsonRPCError(-2002, 'Транзакция не найдена', requestId));      
    }
  }
  catch (err) {
    this.logger.logError('Module reqHandler, method handleTxGet ' + 
        `Error getting transaction for hash ${params.txHash}: `, err);
    response.writeHead(consts.HTTP.STATUS_ETH_GET_DATA_ERR, 'Error getting transaction');
    response.end(this.getJsonRPCError(-1007, err.message, requestId));      
  }
}  // handleTxGet

}  // class

module.exports = reqHandler;
