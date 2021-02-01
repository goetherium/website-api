/****************** Класс получения данных из блокчейна ********************************/

class ethData {

constructor(pLogger, pWeb3, pDebugLevel) {
    this.logger = pLogger;
    this.web3 = pWeb3;
    this.debugLevel = pDebugLevel;
}


/**************************** МЕТОД accountCreate ********************************
 * Создает аккаунт для работы с транзакциями
 * Выходные параметры:
 *   объект: 
 *     address - адрес аккаунта в hex-формате (20 байтов)
 *     privateKey - закрытый ключ аккаунта в hex-формате
 */
accountCreate() {
  const account = this.web3.eth.accounts.create();
  return account;
}

/**************************** МЕТОД accountEncrypt ********************************
 * Шифрует закрытый ключ указанным паролем
 * Входные параметры
 *   privateKey - закрытый ключ в hex-формате
 *   password - пароль шифрования
 * Выходные параметры:
 *   объект: keystore v3
 */
accountEncrypt(privateKey, password) {
  const keystore = this.web3.eth.accounts.encrypt(privateKey, password);
  password = null;  // очищаем в памяти
  return keystore;
}

/**************************** МЕТОД accountDecrypt ********************************
 * Расшифровывает закрытый ключ указанным паролем
 * Входные параметры
 *   keystore - объект: зашифрованное файловое хранилище
 *   password - строка: пароль дешифрования
 * Выходные параметры:
 *   privateKey - строка: закрытый ключ
 */
accountDecrypt(keystore, password) {
  const decryped_account = this.web3.eth.accounts.decrypt(keystore, password);
  password = null;  // очищаем в памяти
  return decryped_account.privateKey;
}

/**************************** МЕТОД accountGetBalance ********************************
 * Расшифровывает закрытый ключ указанным паролем
 * Вход: адрес аккаунту в hex-формате
 * Выход: баланс в эфирах
 */
async accountGetBalance(address) {
  const balanceWei = await this.web3.eth.getBalance(address);
  return this.utilFromWeiToEther(balanceWei);
}

/**************************** МЕТОД signTransaction ********************************
 * Подписывает транзакцию.
 * Входные параметры
 *   toAddress  - адрес получателя
 *   etherValue - сумма транзакции в эфирах (необязательный параметр)
 *   privateKey - закрытый ключ, полученный при создании аккаунта
 * Выходные параметры:
 *   rawTransaction - RLP-кодированная транзакция, готовая
 *   к отправке методом web3.eth.sendSignedTransaction.
 */
async signTransaction(toAddress, etherValue, privateKey) 
{
  this.logger.logDebug('Module ethData, method signTransaction. ' + 
    `toAddress: ${toAddress}, etherValue: ${etherValue}`);

  // состав транзакции
  let txObj = {
    to: toAddress
  }

  txObj.gas = await this.web3.eth.estimateGas(txObj);
  this.logger.logDebug('Module ethData, method signTransaction. ' + 
                       `Выполнена оценка газа: ${txObj.gas}`);

  if (etherValue) {
    txObj.value = this.utilFromEtherToWei(etherValue);
    this.logger.logDebug('Module ethData, method signTransaction. ' + 
                         `Эфиры переведены в wei: ${txObj.value}`);
  }

  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug(`Module ethData, method signTransaction. ` + 
        `Transaction to sign: ${JSON.stringify(txObj)}`);
  }

  /* Значение остальных параметров будут автоматически получены так:
   *   nonce: web3.eth.getTransactionCount()
   *   chainId: web3.eth.net.getId()
   *   gasPrice: web3.eth.getGasPrice()
   */
  const resObj = await this.web3.eth.accounts.signTransaction(txObj, privateKey);
  return resObj.rawTransaction;
}

/**************************** МЕТОД sendSignedTransaction ********************************
 * Отправляет подписанную транзакцию в сеть.
 * Входные параметры
 *   signedTransaction - подписанная методом web3.eth.accounts.signTransaction транзакция
 * Выходной параметр - объект:
 *   txHash - hex-строка: хэш транзакции
 *   blockNumber - номер блока, в который включена транзакция                             
 *   contractAddress - hex-адрес созданного контракта, если адрес получателя не был указан
 */
async sendSignedTransaction(pSignedTransaction)
{
  let resObj;

  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug(`Module ethData, method sendSignedTransaction. ` + 
        `Signed transaction: ${pSignedTransaction}`);
  }
  // Промис разрешается при получении рецепта транзакции
  const receipt = await this.web3.eth.sendSignedTransaction(pSignedTransaction);
  if (this.debugLevel === 'Debug' ) {
    this.logger.logDebug(`Module ethData, method sendSignedTransaction. ` + 
      `Transaction receipt: ${JSON.stringify(receipt)}`);
  }
  // Проверяем статус транзакции в рецепте
  if (receipt.status) {
    this.logger.logDebug('Module ethData, method sendSignedTransaction. Transaction is successful');
    // Заполняем объект с результатом
    resObj = {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    };
    // Если был создан контракт
    if (receipt.contractAddress) {
      resObj.contractAddress = receipt.contractAddress;
    }
    this.logger.logDebug('Module ethData, method sendSignedTransaction. ' + 
      `Result object: ${JSON.stringify(resObj)}`);
    return resObj;
  }
  else {
    this.logger.logError('Module ethData, method sendSignedTransaction. ' + 
      `Signed transaction: ${pSignedTransaction} is failed`);
    throw new Error('Ошибка отправки транзакции');
  }
}


/**************************** МЕТОД getTransaction ********************************
 * Возвращает промис с транзакцией в виде объекта
 * Входные параметры:
 *   txHash - хэш транзакции
 */
getTransaction(txHash) {
  this.logger.logDebug(`Module ethData, method getTransaction. Хэш транзакции: ${txHash}`);
  // web3 вернёт адреса в котрольном формате
  return this.web3.eth.getTransaction(txHash).then( Tx => {
    if (!Tx) {
      return null;
    }
    if (this.debugLevel === 'Debug' ) {
      this.logger.logDebug('Module ethData, method getTransaction. ' + 
        `Получены данные транзакции: ${JSON.stringify(Tx)}`);
    }

    const etherValue = this.web3.utils.fromWei(String(Tx.value), 'ether');
    const gasPrice = this.web3.utils.fromWei(String(Tx.gasPrice), 'ether');
    const gasUsed = this.web3.utils.fromWei(String(Tx.gas), 'ether');

    const txObj = {
      hash: Tx.hash,
      nonce: Tx.nonce,
      blockHash: Tx.blockHash,
      blockNumber: Tx.blockNumber,
      transactionIndex: Tx.transactionIndex,
      from: Tx.from,
      to: Tx.to,
      value: etherValue,
      gasUsed: gasUsed,
      gasPrice: gasPrice,
      input: Tx.input,            
    };
    return txObj;
  });
};

/**************************** МЕТОД getBlock ********************************
 * Возвращает из блокчейна запрошенный блок в сериализованном JSON
 * Входные параметры:
 *   blockNumber - номер блока
 */
getBlock(blockNumber) {
  return web3.eth.getBlock(blockNumber).then( block => {
    if (this.debugLevel === 'Debug' ) {
      this.logger.logDebug(`Module ethData, method getBlock. Result calling web3.eth.getBlock(${blockNumber}): `, block);
    }
    return JSON.stringify({
            height: block.number,
            hash: block.hash,
            timestamp: block.timestamp,
            gasUsed: block.gasUsed,
          });
    });
};

/************************** МЕТОД subscribeLogs *******************************
 * Запускает подписку на логи и возвращает объект подписки
 * Для тестирования.
 * Не используется в проекте
 */
async subscribeLogs() {
  // Адрес контракта
  const myContractAddress = 'указать_адрес';

  /* Хэш сигнатуры топика события IntEvent контракта
   * Данное событие имеет только один неидексированный параметр - uint256
   * Заменим вызов
   *     web3.eth.abi.encodeEventSignature('IntEvent(uint256)');
   * на готовый хэш, чтобы уменьшить блокирование EventLoop движка Node,
   * т.к. это синхронный вызов
   */
  const myTopic = 'указать_топик';

  /* Параметры подписки - фильтрация логов будет по адресу контракта и первому топику:
   * так как в событии нет индексированных параметров, то в логе будет только один топик -
   * хэш сигнатуры событий, он всегда первый топик
   */
  const subscribe_options = {
    address: myContractAddress,
    topics: [myTopic]
  };

  /* Запускаем подписку, результат - объект EventEmitter.
   * Возвращает в аргументе result массив объектов - логов.
   * Поскольку в вызываемом (через транзакцию) методе контракта испускается только одно событие,
   * то в массиве логов будет только один элемент, содержащий это событие
   *
   * Callback функция, указанная в третьем параметре будет запущена для каждого лога!
   * При чем она запускается ПОСЛЕ запуска обработчика события on('data')!
   *
   */
  const subscription = await new Promise( (resolve, reject) => {
    const _subscription = web3.eth.subscribe('logs', subscribe_options)
    .on('connected', subscriptionId => {
      this.logger.logDebug(`Module ethData, method subscribeLogs. Result calling web3.eth.subscribe - subscriptionId: ${subscriptionId}`);
      resolve(_subscription);
    }).on('error', err => {
      this.logger.logError('Module ethData, method subscribeLogs. Error calling web3.eth.subscribe, call stack:', err);          
      reject(err);
    });
  });

  // Возвращаем объект подписки
  return subscription;

};  // метод subscribeLogs


/************************** МЕТОД decodeLog *******************************
 * Декодирует полученный лог транзакции и возвращает его в формате JSON
 * Для тестирования.
 * Не используется в проекте
 */
async decodeLog(log) {
  try {
    /* Пример лога транзакции
      { address: '0x744c17b78c3bc8D490B367039D2A47314c7f9544',
        topics: [ '0xa66e3d99cea58d39cb278611964329fa8d4b08252d747eced50565286fb225c0' ],
        data: '0x0000000000000000000000000000000000000000000000000000000000000102',
        blockNumber: 3467,
        txHash: '0xd76281d48e86814caeaff1850dbf5b75defcdf6d1ee0414bb66dacf69122164e',
        transactionIndex: 0,
        blockHash: '0x46ae9cc8d9548056fc655316e614c4cdd562360e07f08dc77c140e390d5dbd62',
        logIndex: 0,
        removed: false,
        id: 'log_17b58a94'
      }
    */
    // Декодируем единственный параметр
    const resNumber = web3.eth.abi.decodeParameter('uint256', log.data);
    this.logger.logDebug(`Module ethData, method decodeLog. Result calling web3.eth.abi.decodeParameter - param: ${resNumber}`);
    // Сериализуем параметр
    return JSON.stringify(
                          {
                            txResult: resNumber
                          }
    );
  }
  catch(err) {
    this.logger.logError('Module ethData, method decodeLog. Error calling web3.eth.abi.decodeParameter, call stack:', err);
    return err;
  }
};  // decodeLog



/**************************** Вспомогательные методы ********************************/
// Переводит эфиры в wei
utilFromEtherToWei(etherValue) {
  return this.web3.utils.toWei(etherValue, 'ether');
}
// Переводит wei в эфиры
utilFromWeiToEther(weiValue) {
  return this.web3.utils.fromWei(weiValue, 'ether');
}


}  // class

module.exports = ethData;
