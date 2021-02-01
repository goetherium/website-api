// hex-префикс
const hexPrefix = '0x';


/****************** Класс работы с БД PostgreSQL ********************************/

class dbPostgres {

constructor(pLogger, pDebugLevel, pDBPool) {
  this.logger = pLogger;
  this.debugLevel = pDebugLevel;
  this.dbPool = pDBPool;
  // the pool will emit an error on behalf of any idle clients
  // it contains if a backend error or network partition happens
  this.dbPool.on('error', (err, client) => {
    this.logger.logError('Module postgres, method constructor, fired event error on db connection pool: ', err);
  });
}



/**************************** МЕТОД userAdd ********************************
 * Добавляет пользователя в БД
 * Входные параметры:
 *   pRealm - строка: реалм пользователей
 *   pUserLogin - строка: логин пользователя во внешней системе
 * Возвращает сообщение об успешно добавленном пользователе
 * или пусто, если пользователь уже существует
 * или генерит исключение с ошибкой добавления.
 */
async userAdd(pRealm, pUserLogin) {
  this.logger.logDebug('Module postgres, method userAdd. ' + 
                       `Реалм: ${pRealm}, логин: ${pUserLogin}`);

  let client;
  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();

    const queryObject = {
      name: 'userAdd',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select users.user_f_add($1,$2)',
      values: [pRealm, pUserLogin]
    }
    // Выполнение функции в SQL запросе: транзакция будет зафиксирована автоматически
    const res = await client.query(queryObject);
    // При успехе возврат  {"createdDate":"2020-12-26 11:27:44"}
    // При ошибке {"error":{"code":код,"message":"текст"}}
    let resObj = {};
    if (typeof res.rows[0].user_f_add == 'object') {
      resObj = res.rows[0].user_f_add;
    }
    else {
      resObj = JSON.parse(res.rows[0].user_f_add);
    }
    this.logger.logDebug(`Module postgres, method userAdd. Результат: ${JSON.stringify(resObj)}`);

    if (resObj.createdDate) {
      // Преобразуем текст в дату
      resObj.createdDate = new Date(resObj.createdDate);
      return resObj;
    }
    else if (resObj.error.code === -2001) {
      // пользователь уже существует, не будем считать ошибкой
      return null;
    }
    else {
      throw new Error(resObj.error.message);
    }
  }
  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method userAdd, client was released into the connection pool');
    }
  }
}

/**************************** МЕТОД userGetByLogin ********************************
 * Проверка существования пользователя в БД
 * Входные параметры:
 *   pRealm - строка: реалм пользователей
 *   pUserLogin – строка: логин пользователя в приложении.
 * Возвращает:
 *   createdDate – дата создания
 */
async userGetByLogin(pRealm, pUserLogin)
{
  let client;

  this.logger.logDebug('Module postgres, method userGetByLogin. ' + 
                       `Реалм ${pRealm}, логин ${pUserLogin}`);

  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    
    const queryObject = {
      name: 'userGet',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select user_id, created_date ' + 
            'from users.users_v ' + 
            'where realm = $1 ' + 
            '  and user_login = $2',
      values: [pRealm, pUserLogin]
    }
    const res = await client.query(queryObject);
    if (res.rows.length === 0) {
      this.logger.logDebug('Module postgres, method userGetByLogin. Пользователь не найден');
      // отсутствие пользователя не считаем ошибкой
      return null;
    }
    else {
      const resObj = {
        userId: res.rows[0].user_id,
        createdDate: res.rows[0].created_date
      };
      this.logger.logDebug('Module postgres, method userGetByLogin. Найден пользователь:' + 
        `${JSON.stringify(resObj)}`);
      return resObj;
    }
  }
  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method userGetByLogin, client was released into the connection pool');
    }
  }
}  // userGet


/************************* МЕТОД userGetByAddress ********************************
 * Получение пользователя из БД по адресу аккаунта.
 * Внутренний метод.
 * Входные параметры:
 *   pAccountAddress – Адрес аккаунта Ethereum (hex)
 * Возвращает:
 *   userId - id пользователя
 *   userLogin - логин пользователя
 *   createdDate – дата создания
 */
async userGetByAddress(pAccountAddress)
{
  let client;

  this.logger.logDebug(`Module postgres, method userGetByAddress. Адрес ${pAccountAddress}`);

  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    
    const queryObject = {
      name: 'userGetByAddr',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select user_id, user_login, user_created_date ' + 
            'from users.user_accounts_v ' +
            'where account_address = $1',
      values: [pAccountAddress]
    }
    const res = await client.query(queryObject);
    if (res.rows.length === 0) {
      const errMsg = 'Аккаунт ' + pAccountAddress + ' не найден';
      this.logger.logError('Module postgres, method userGetByAddress. ' + errMsg);
      throw new Error(errMsg);
    }
    else {
      const resObj = {
        userId: res.rows[0].user_id,
        userLogin: res.rows[0].user_login,
        createdDate: res.rows[0].user_created_date
      };
      this.logger.logDebug('Module postgres, method userGetByAddress. Найден пользователь:' + 
        `${JSON.stringify(resObj)}`);
      return resObj;
    }
  }
  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method userGetByAddress, client was released into the connection pool');
    }
  }
}  // userGetByAddress


/**************************** МЕТОД accountAdd ********************************
 * Добавляет учетную запись (аккаунт) в БД
 * Входные параметры:
 *   pUserLogin - логин пользователя во внешней системе
 *   pAccountAddress - Адрес аккаунта Ethereum (hex)
 *   pAccountName - Пользовательское наименование аккаунта
 *   pEncryptedKey - Зашифрованный закрытый ключ в формате JSON
 *   pSalt - Соль шифрования пароля закрытого ключа
 * Возвращает сообщение об успешно добавленном аккаунте
 * или пусто, если аккаунт уже существует
 * или генерит исключение с ошибкой добавления.
 */
async accountAdd(
  pUserId
, pAccountAddress
, pAccountName
, pEncryptedKey
, pSalt
)
{
  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug(`Module postgres, method accountAdd. Input params: ` + 
      `UserId: ${pUserId}, ` + 
      `accountAddress: ${pAccountAddress}, ` + 
      `accountName: ${pAccountName}, ` + 
      `encryptedKey: ${JSON.stringify(pEncryptedKey)}, ` + 
      `salt: ${pSalt}`);
  }

  let client;
  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    
    const queryObject = {
      name: 'accountAdd',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select users.account_f_add($1,$2,$3,$4,$5)',
      values: [pUserId, pAccountAddress, pAccountName, pEncryptedKey, pSalt]
    }
    // Выполнение функции в SQL запросе: транзакция будет зафиксирована автоматически
    const res = await client.query(queryObject);
    // При успехе  {"createdDate":"2020-12-26T11:27:44Z"}
    // При ошибке {"error":{"code":код,"message":"текст"}}
    let resObj = {};
    if (typeof res.rows[0].account_f_add == 'object') {
      resObj = res.rows[0].account_f_add;
    }
    else {
      resObj = JSON.parse(res.rows[0].account_f_add);
    }
    this.logger.logDebug(`Module postgres, method accountAdd. Результат: ${JSON.stringify(resObj)}`);

    if (resObj.createdDate) {
      // Преобразуем текст в дату
      resObj.createdDate = new Date(resObj.createdDate);
      return resObj;
    }
    else if (resObj.error.code === -2001) {
      // аккаунт уже существует, не будем считать ошибкой
      return null;
    }
    else {
      throw new Error(resObj.error.message);
    }
  }
  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method accountAdd, client was released into the connection pool');
    }
  }
}  // accountAdd

/**************************** МЕТОД accountGetList ********************************
 * Получение списка аккаунтов пользователя из БД
 * Входные параметры:
 *   pUserId - число: id пользователя.
 * Возвращает:
 * Массив, в котором каждая запись имеет атрибуты:
 *   accountAddress – адрес аккаунта в блокчейне
 *   accountName – пользовательское наименование для сайта
 *   createdDate – дата создания
 * или пусто, если аккаунты не найдены
 */
async accountGetList(pUserId)
{
  let client;

  this.logger.logDebug(`Module postgres, method accountGetList. Логин ${pUserId}`);

  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    
    const queryObject = {
      name: 'accountGetList',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select account_address, account_name, account_created_date ' + 
            'from users.accounts_v ' + 
            'where user_id = $1',
      values: [pUserId]
    }

    const res = await client.query(queryObject);
    if (res.rows.length === 0) {
      // аккаунта нет, не будем считать ошибкой
      this.logger.logDebug('Module postgres, method accountGetList. Аккаунт не найден БД');
      return null;
    }
    else {
      // Формируем массив результатов
      let accountArr = new Array();
      for (let i = 0; i < res.rows.length; i++) {
        accountArr[i] = {
          accountAddress: hexPrefix + res.rows[i].account_address,
          accountName: res.rows[i].account_name,
          createdDate: res.rows[i].account_created_date,
        }
      }
      if (this.debugLevel === 'Debug' ) {
        this.logger.logDebug('Module postgres, method accountGetList. Получен список аккаунтов');
      }
      return accountArr;
    }  // if .. else
  }
  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method accountGetList, client was released into the connection pool');
    }
  }
}  // accountGetList


/**************************** МЕТОД keystoreGet ********************************
 * Внутренний метод
 * Получает зашифрованный файл с закрытым ключом и солью шифрования из БД
 * Входные параметры:
 *   pAccountAddress - Адрес аккаунта Ethereum (hex)
 * Возвращает зашифрованный файл в виде объекта.
 */
async keystoreGet(pAccountAddress)
{
  let client;

  this.logger.logDebug(`Module postgres, method keystoreGet. Account address: ${pAccountAddress}`);

  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    
    const queryObject = {
      name: 'keystoreGet',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select encrypted_key, salt from users.accounts_v where account_address = $1',
      values: [pAccountAddress]
    }
    const res = await client.query(queryObject);
    if (res.rows.length === 0) {
      const errMsg = 'Учетная запись с адресом ' + pAccountAddress + ' не найдена';
      this.logger.logError('Module postgres, method keystoreGet. ' + errMsg);
      throw new Error(errMsg);
    }

    let keystoreObj = {};
    if (typeof res.rows[0].encrypted_key == 'object') {
      keystoreObj.encrypted_key = res.rows[0].encrypted_key;
      keystoreObj.salt = res.rows[0].salt;
    }
    else {
      keystoreObj.encrypted_key = JSON.parse(res.rows[0].encrypted_key);
      keystoreObj.salt = res.rows[0].salt;
    }
    if (this.debugLevel === 'Debug' ) {
      this.logger.logDebug(`Module postgres, method keystoreGet. ` + 
        `Keystore: ${JSON.stringify(keystoreObj.encrypted_key)}`);
    }
    return keystoreObj;
  }
  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method keystoreGet, client was released into the connection pool');
    }
  }
}  // keystoreGet

/**************************** МЕТОД txAdd ********************************
 * Сохраняет транзакцию в БД
 * Входные параметры:
 *   pTxHash - hex-строка: хэш транзакции
 *   pSourceAddress - hex-строка: адрес-отправитель
 *   pDestAddress -  hex-строка: адрес-получатель
 *   pWeiValue - сумма транзакции в wei
 * Возвращает дату записи транзакции в БД
 * или генерит исключение с ошибкой добавления.
 */
async txAdd(pTxHash, pSourceAddress, pDestAddress, pWeiValue)
{
  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug('Module postgres, method txAdd. Input params: ' + 
      `Transaction hash: ${pTxHash}, ` + 
      `From address: ${pSourceAddress}, ` + 
      `To address: ${pDestAddress}, ` + 
      `wei value: ${pWeiValue}`
    );
  }

  let client;
  try {
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    
    const queryObject = {
      name: 'addTx',  // если текст запроса изменяется переменными, имя запроса также нужно изменить
      text: 'select tx.tx_f_out_add($1,$2,$3,$4)',
      values: [pTxHash, pSourceAddress, pDestAddress, pWeiValue]
    }
    // Выполнение функции в SQL запросе: транзакция будет зафиксирована автоматически
    const res = await client.query(queryObject);
    // При успехе  {"createdDate":"2020-12-26T11:27:44Z"}
    // При ошибке "error":{"code":код,"message":"текст ошибки"}}
    let resObj = {};
    if (typeof res.rows[0].tx_f_out_add == 'object') {
      resObj = res.rows[0].tx_f_out_add;
    }
    else {
      resObj = JSON.parse(res.rows[0].tx_f_out_add);
    }
    this.logger.logDebug(`Module postgres, method txAdd. Результат: ${JSON.stringify(resObj)}`);

    if (resObj.createdDate) {
      // Преобразуем текст в дату
      resObj.createdDate = new Date(resObj.createdDate);
      return resObj;
    }
    else if (resObj.error.code === -2001) {
      // Транзакция уже существует, не будем считать ошибкой
      return null;
    }
    else {
      throw new Error(resObj.error.message);
    }
  }
  finally {
    if (client) {
      client.release();
      this.logger.logDebug('Module postgres, method txAdd, client was released into the connection pool');
    }
  }
}  // txAdd

/**************************** МЕТОД txGetList ********************************
 * Получение исходящих и входящих транзакций из БД для указанного аккаунта
 * Входные параметры:
 *   pDirection: 
 *     Out - транзакции, сделанные с аккаунта
 *     In - входящие на аккаунт транзакции
 *   pAccountAddress – hex-строка: адрес аккаунта пользователя
 *   pDateFrom - дата в JSON-формате: начальная дата транзакций.
 *               Если не указана, то неделя от текущей даты
 *   pDateTo - дата в JSON-формате: конечная дата транзакций
 *             Если не указана, то текущая дата
 *   pSortOrder - направление сортировки:
 *     Asc - сначала старые транзакции
 *     Desc - сначала новые транзакции
 *     NoSort - без сортировки (по умолчанию)
 * Возвращает вложенный массив, каждый элемент имеет состав:
 *   txHash - hex-строка: хэш транзакции
 *   sourceAddress - hex-строка: адрес отправителя
 *   destAddress - hex-строка: адрес получателя
 *   createdDate - дата в JSON-формате: дата транзакции
 * или пусто, если транзакции не найдены
 */
async txGetList(pDirection, pAccountAddress, pDateFrom, pDateTo, pSortOrder)
{
  this.logger.logDebug('Module postgres, method txGetList. Параметры: ' + 
      `direction ${pDirection}, accountAddress ${pAccountAddress}, ` + 
      `dateFrom ${pDateFrom}, dateTo ${pDateTo}, sortOrder ${pSortOrder}`);

  let client;

  try {
    let timestamp;
    // Если начальная дата в неверном формате или не указана, принимаем неделю назад
    let dateFrom;
    if (pDateFrom) {
      timestamp = Date.parse(pDateFrom);  // вернет число миллисекунд с 1970г
      if (isNaN(timestamp)) {
        dateFrom = new Date(Date.now() - 7*24*3600*1000);
        this.logger.logDebug('Module postgres, method txGetList. Берём вычисленную dateFrom');
      }
      else {
        /* Клиент присылает время в UTC, node-postgres автоматически приведет его в локальное
         * время перед отправкой в БД. В БД время хранится с временной зоной.
         */
        dateFrom = new Date(timestamp);
      }
    }
    else {
      dateFrom = new Date(Date.now() - 7*24*3600*1000);
    }
  
    // Если конечная дата в неверном формате или не указана, принимаем текущую
    let dateTo;
    if (pDateTo) {
      timestamp = Date.parse(pDateTo);
      if (isNaN(timestamp)) {
        dateTo = new Date();
        this.logger.logDebug('Module postgres, method txGetList. Берём вычисленную dateTo');
      }
      else {
        dateTo = new Date(timestamp);
      }
    }
    else {
      dateTo = new Date();
    }
    let sortOrder;
    if (pSortOrder === 'Asc') sortOrder = 'asc';
    else if (pSortOrder === 'Desc') sortOrder = 'desc';
    else sortOrder = '';

    this.logger.logDebug('Module postgres, method txGetList. Вычислены параметры запроса: ' + 
    `dateFrom ${dateFrom}, dateTo ${dateTo}, sortOrder ${sortOrder}`);

    let queryObject = {};

    if (pDirection === 'Out') {
      // Из-за сортировки текст запроса меняется и если не менять имя запроса, будет ошибка:
      // Prepared statements must be unique - 'txGetList' was used for a different statement
      queryObject = {
        name: `txGetListOut${sortOrder}`,
        text: 'select source_user_login, dest_user_login, tx_hash, source_address,' + 
              '       dest_address, tx_created_date, wei_value ' +
              'from tx.txs_out_v ' + 
              'where source_address = $1 ' + 
              '  and tx_created_date between $2 and $3' + 
              `order by tx_created_date ${sortOrder}`,
        values: [pAccountAddress, dateFrom, dateTo]
      }
    }
    else if (pDirection === 'In') {
      queryObject = {
        name: `txGetListIn${sortOrder}`,  // добавим сортировку в имя запроса для уникальности
        text: 'select source_user_login, dest_user_login, tx_hash, source_address,' + 
              '       dest_address, tx_created_date, wei_value ' +
              'from tx.txs_in_v ' + 
              'where dest_address = $1 ' + 
              '  and tx_created_date between $2 and $3' + 
              `order by tx_created_date ${sortOrder}`,
        values: [pAccountAddress, dateFrom, dateTo]
      }
    }

    if (!queryObject) {
      this.logger.logError('Module postgres, method txGetList. Не сформирован объект запроса');
      return null;
    }
    
    // Получаем клиента из пула соединений
    client = await this.dbPool.connect();
    const res = await client.query(queryObject);
    if (res.rows.length === 0) {
      // отсутствие транзакций не считаем ошибкой
      this.logger.logDebug('Module postgres, method txGetList. Транзакций не найдено');
      return null;
    }
    else {
      // Формируем массив результатов
      let arrTx = new Array();
      for (let i = 0; i < res.rows.length; i++) {
        arrTx[i] = {
            sourceUserLogin: res.rows[i].source_user_login,
            destUserLogin: res.rows[i].dest_user_login,
            txHash: hexPrefix + res.rows[i].tx_hash, 
            sourceAddress: hexPrefix + res.rows[i].source_address, 
            destAddress: hexPrefix + res.rows[i].dest_address,
            txCreatedDate: res.rows[i].tx_created_date,
            weiValue : res.rows[i].wei_value,
        }
      }
      this.logger.logDebug('Module postgres, method txGetList. Получен список транзакций');
      return arrTx;
    }
  }  // if..else

  finally {
    if (client) {
      client.release();  // Возвращаем клиента в пул
      this.logger.logDebug('Module postgres, method txGetList, client was released into the connection pool');
    }
  }
}  // txGetList



}  // class

module.exports = dbPostgres;
