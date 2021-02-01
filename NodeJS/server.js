/* Обработка запросов к блокчейну и БД PostreSQL по протоколу HTTP(S).
 * Поскольку nginx не поддерживает проксирование по HTTP/2, используем HTTP 1.1.
 * Проверку запросов к серверу можно выполнить на lb-01, 
 * на нем установлен сертификат, выданный доверенным центром LetsEncrypt
 * curl -v --tlsv1.3 --http2.0 --header "Connection: Keep-Alive" --header "Keep-Alive: timeout=55, max=1000" --header "Content-Type: application/json" --data '{"userLogin":"Account1"}' --key /etc/letsencrypt/live/alladin.host/privkey.pem --cert /etc/letsencrypt/live/alladin.host/fullchain.pem https://80.211.184.173:8443
 */

//*************** Обработка параметров запуска ******************/
/* Пример строки запуска
 * sudo -u nodejs 
 * /usr/local/bin/node - первый параметр
 * /home/nodejs/eth/prod/server.js  - второй параметр
 * ServerPort=8443  - третий параметр
 * DebugLevel=Debug  - четвёртный параметр
 * TLSTraceEnable=true - пятый параметр
*/

// Выводим в журнал (syslog) параметры запуска
console.log('NodeJS is running with parameters');
process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
});

/* Первый параметр - путь к NodeJS
 * /usr/local/bin/node
 * Второй параметр - пусть к данному скрипту сервера
 * /home/nodejs/eth/prod/server.js
 */
// Третий параметр - порт для прослушивания, например ServerPort=8080
const serverPort = process.argv[2].substr(11);
// Четвертый параметр - уровень сообщений, например DebugLevel=Info
// Возможные значения: Debug, Info, Warn, Error в порядке понижения уровня
const debugLevel = process.argv[3].substr(11);
// Пятый параметр - флаг (true/false) необходимости трассировки TLS-соединения
const tlsTraceEnable = process.argv[4].substr(15);


/* Отличие в запуске HTTPS сервера от http:
 * 1) загрузка модуля require('https') вместо require('http')
 * 2) при создании сервера указывается сертификат
 */

//*************** Загрузка модулей ******************/
// Пусть к сторонним подключаемым модулям
const modulePath = '/usr/local/lib/node_modules/npm/node_modules';

// Константы
const consts = require('./const.js');

// Логирование сообщений и ошибок
const Logger = require('./logger.js');
const logger = new Logger(debugLevel);

// Библиотека wеb3.js для работы с аккаунтами и блокчейном
// https://web3js.readthedocs.io/
const Web3 = require(modulePath + '/web3');

/* Для работы с Geth используем IPC для повышения безопасности.
 * Это требует запуска провайдера Geth на локальном хосте.
 * Для работы с Unix domain socket нужен модуль net.
 */
const net = require('net');
const web3 = new Web3('/home/geth/.ethereum/geth.ipc', net);

// Вариант с использованием веб-сокетов, т.к. подписка не работает через HTTP.
// Требует запуска HTTP-RPC сервера, что не позволяет подписывать блоки.
//const web3 = new Web3('ws://' + hostIP + ':8546');

// Класс взаимодействия с Geth
const EthData = require('./ethData.js');
const ethData = new EthData(logger, web3, debugLevel);

// Работа с БД PostgeSQL (https://node-postgres.com/api)
// Используем пул соединений для увеличения производительности
const { Pool } = require(modulePath + '/pg');
// Подключение через IPC-сокет
const dbPool = new Pool({
    host: '/var/run/postgresql/',
    database: 'nodejs',
    post: 5432,  // порт по умолчанию
    user: 'nodejs',
    client_encoding: 'UTF8'
});
const dbPostgres = require('./postgres.js');
const pgData = new dbPostgres(logger, debugLevel, dbPool);


/* Обработка клиентских HTTP запросов.
 * Тест показал, что если в запросе будет заголовок
 * Connection: Keep-Alive, то метод сервера response.end() 
 * отправит клиенту заголовок Connection: keep-alive
 * иначе сервер ответит Connection: close.
 */
const RequestHandler = require('./reqHandler.js');
const reqHandler = new RequestHandler(logger, debugLevel, ethData, pgData);

//*************** Запуск сервера и регистрация обработчиков ******************/
const https = require('https');
//const http = require('http');  // http-вариант
const fs = require('fs');        // для загрузки сертификатов

let enableServerTLSTrace;
if (tlsTraceEnable === 'true' ) {
  enableServerTLSTrace = true;
}
else {
  enableServerTLSTrace = false;
}

const serverOptions = {
  cert: fs.readFileSync('/home/nodejs/cert/BackEnd.pem'),
  key: fs.readFileSync('/home/nodejs/cert/BackEnd.key'),
  // запрещаем версии TLS ниже 1.3
  minVersion: 'TLSv1.3',
  maxVersion: 'TLSv1.3',
  // request a certificate from clients that connect 
  // and attempt to verify that certificate
  requestCert: true,  
  // reject any connection which is not authorized with the list of supplied CAs
  rejectUnauthorized: true,
  // TLS packet trace information is written to stderr. 
  // This can be used to debug TLS connection problems.
  enableTrace: enableServerTLSTrace

  // Это необходимо, если клиент использует самоподписанный сертификат.
  // В нашем случае не нужно, т.к. Nginx предъявит сертификат LetsEncrypt
  //ca: fs.readFileSync('/home/nodejs/cert/client.pem'),
};

// Create an HTTPS server
const server = https.createServer(serverOptions);
// Create an http server
// const server = http.createServer();

server.on('request', (request, response) => {
  // ip адрес клиента прокси nginx сохраняет в заголовке x-real-ip
  logger.logInfo(`ClientIP: ${request.headers["x-real-ip"]} | ` +
                 `${request.method} HTTP/${request.httpVersion} | ` + 
                 `URI: ${request.url.slice(0,1000)} | Host: ${request.headers.host} | ` + 
                 `ProxyIP: ${response.socket.remoteAddress}`);
  if (debugLevel === 'Debug' ) {
    logger.logDebug('Headers:', request.headers);
  }

  try 
  {
    const reqURL = new URL(request.url, `http://${request.headers.host}`);
    logger.logDebug('Module server. Client request:', reqURL.href);

    if (request.method === 'GET') {
      handleGetRequest(reqURL, response);  // обработка метода GET
    }

    else if (request.method === 'POST') {
      /* Формат POST-запросов по протоколу JSON-RPC
       * https://www.jsonrpc.org/specification.
       * Пример:
       * {"jsonrpc":"2.0", "method":"account_userAdd", 
       *  "params":{"userLogin":"Account1"}, "id":1}
       */
      let postData = '';
      // Собираем данные post-запроса
      request.on('data', chunk => {
          postData += chunk;
      });

      // Получены все данные post-запроса
      request.on('end', () => {
        let reqObj;
        // При отладке логируем полный запрос
        if (debugLevel === 'Debug' ) {
          logger.logDebug('Module server. Client post data:', postData);
        }
        else {
          // Логируем часть данных post-запроса
          logger.logInfo(`Client post data (first 1000 bytes): ${postData.slice(0,1000)}`);
        }

        try {
          reqObj = JSON.parse(postData);
        }
        catch {
          logger.logError(`Module server. Invalid JSON-RPC: ${postData.slice(0,1000)}`);
          response.setHeader('Content-Type', 'application/json');
          response.writeHead(consts.HTTP.UNPROCESSABLE_ENTITY);
          response.end(reqHandler.getJsonRPCError(-32600, 'Invalid JSON', null));
          return;
        }
        // Проверка соответствия запроса протоколу JSON-RPC
        if (!checkJsonRpcRequest(reqObj, response)) {
          return;
        }
        // Вызов обработчика запрошенного метода
        handleJsonRpcRequest(reqObj, response);
      });  
    }

    // Неподдерживаемые HTTP-методы
    else {
      logger.logError(`Module server. Unsupported HTTP method: ${request.method}`);
      response.writeHead(consts.HTTP.STATUS_METHOD_NOT_ALLOWED);
      response.end();
      return;
    }
  }
  catch (err) {
    handleError(err, response);
  }

});  // server.on('request')


server.listen(serverPort);
logger.logInfo(`Server is running on port ${serverPort}`);


// Здесь нужно корректно закрыть ресурсы (файлы, ...), записать ошибку.
process.on('uncaughtException', (err, origin) => {
  logger.logError('Module server. Unhandled process error: ', err, origin);
});

// Обработка необработанных в вызываемых модулях ошибок
function handleError(err, response) {
  logger.logError('Module server. Unhandled error: ', err);
  // пошлём клиенту код ответа
  if (!response.headersSent) {
    response.writeHead(consts.HTTP.INTERNAL_SERVER_ERROR);
  }
  // пошлём клиенту ответ
  if (!response.writableEnded) {
    response.end();
  }
}

function checkJsonRpcRequest(reqObj, response) {
  response.setHeader('Content-Type', 'application/json');
  // Проверка версии
  if (reqObj.jsonrpc != consts.jsonRPCVersion) {
    logger.logError('Module server. Unsupported JSON-RPC version: ', reqObj.jsonrpc);
    response.writeHead(consts.HTTP.UNPROCESSABLE_ENTITY);
    response.end(reqHandler.getJsonRPCError(-32600, 'Unsupported JSON-RPC version', reqObj.id));
    return false;
  }
  // Проверка метода
  if (!reqObj.method) {
    logger.logError('Module server. Not specified method');
    response.writeHead(consts.HTTP.UNPROCESSABLE_ENTITY);
    response.end(reqHandler.getJsonRPCError(-32600, 'Method is not specified', reqObj.id));
    return false;
  }
  // Проверка id запроса
  if (!reqObj.id) {
    logger.logError('Module server. Not specified request id');
    response.writeHead(consts.HTTP.UNPROCESSABLE_ENTITY);
    response.end(reqHandler.getJsonRPCError(-32600, 'Request id is not specified', reqObj.id));
    return false;
  }
  return true;
}

function handleJsonRpcRequest(reqObj, response) {
  response.setHeader('Content-Type', 'application/json');
  // Вызов обработчика запрошенного метода
  switch (reqObj.method) {
    case 'userAdd':
      reqHandler.handleUserAdd(response, reqObj.params, reqObj.id).
      catch( err => handleError(err, response));
      break;
    case 'userGet':
      reqHandler.handleUserGet(response, reqObj.params, reqObj.id).
      catch( err => handleError(err, response));
      break;
    case 'accountAdd':
      reqHandler.handleAccountAdd(response, reqObj.params, reqObj.id)
      .catch( err => handleError(err, response));
      break;  // пароль уже обнулён в памяти
    case 'accountGetList':
      reqHandler.handleAccountGetList(response, reqObj.params, reqObj.id)
      .catch( err => handleError(err, response));
      break;
    case 'txSend':
      reqHandler.handleTxSend(response, reqObj.params, reqObj.id)
      .catch( err => handleError(err, response));
      break;  // пароль уже обнулён в памяти
    case 'txGetList':
      reqHandler.handleTxGetList(response, reqObj.params, reqObj.id)
      .catch( err => handleError(err, response));
      break;
    case 'txGet':
      reqHandler.handleTxGet(response, reqObj.params, reqObj.id)
      .catch( err => handleError(err, response));
      break;
    default: 
      logger.logError('Module server. Unsupported JSON-RPC method: ', reqObj.method);
      response.writeHead(consts.HTTP.UNPROCESSABLE_ENTITY);
      response.end(reqHandler.getJsonRPCError(-32601, 'Method not found', reqObj.id));
  }
}

function handleGetRequest(reqURL, response) {
  if (reqURL.pathname.indexOf('/tx') >= 0) {
    reqHandler.handleGetTx(response, reqURL.pathname.substr(4)).
    catch( err => handleError(err, response));
    return;
  }
  else {
    logger.logError('Module server. Unsupported URL path for GET method: ', reqURL.pathname);
    response.writeHead(consts.HTTP.STATUS_NOT_FOUND);
    response.end();
    return;
    /*switch (reqURL.pathname) {
      case '/':
        reqHandler.handleRootReq(stream);
        return;
      case '/eth/getBlock': 
        // Пример заголовка: ':path': '/eth/getBlock?num=3545'
        reqHandler.handleBlockReq(stream, reqURL.searchParams.get('num'));
        return;
      default: 
        logger.logError('Module server. Unsupported URL path for GET method: ', reqURL.pathname);
        response.writeHead(consts.HTTP.STATUS_NOT_FOUND);
        response.end();
        return;
    }*/
  }
}