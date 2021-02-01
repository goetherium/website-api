/****************** Класс логирования сообщений и ошибок ********************************/
const { Console } = require('console');

class Logger {

constructor(pDebugLevel) {
  // Возможные уровни отладки: Debug, Info, Warn, Error в порядке понижения уровня
  // Переменная устанавливается запускаемым скриптом из параметра командной строки.
  if (pDebugLevel) {
    this.debugLevel = pDebugLevel;
  }
  else {
    this.debugLevel = 'Error';
  }
  // Запись будет в стандартный поток, который будет направлен в syslog
  // в конфигурации systemd
  this.logger = new Console({ stdout: process.stdout, stderr: process.stderr });

  /* Вывод отладки в файл
   * this.debugOutput = fs.createWriteStream('/var/log/node/access.log');
   * this.errorOutput = fs.createWriteStream('/var/log/node/error.log');
   * this.logger = new Console({ stdout: this.debugOutput, stderr: this.errorOutput });
   */

  // Включает/выключает логирование отладочных сообщений
  //this.isDebugging = true;  

  // Объект форматирования даты
  /*this.formatter = new Intl.DateTimeFormat("ru-RU", {
    day:      'numeric',
    month:    'numeric',
    year:     'numeric',
    hour:     'numeric',
    minute:   'numeric',
    second:   'numeric',
    timeZone: 'Europe/Moscow'
  });*/
}

// Логирование ошибок
logError(err, ...args) {
  if (this.debugLevel==='Error' || this.debugLevel==='Warn' ||
      this.debugLevel==='Info'  || this.debugLevel==='Debug')
  {
    this.logger.error(err, ...args);
    //this.logger.error(`[${this.formatter.format(new Date())}]`, err, ...args);  // время запрос фиксирует сам rsyslog
    //console.error(new Date(), err, ...args);  // logger подключен к консоли
  }
}

// Логирование предупреждающих сообщений
logWarning(data, ...args) {
  if (this.debugLevel==='Warn' ||
      this.debugLevel==='Info' ||
      this.debugLevel==='Debug')
  {
    this.logger.log(data, ...args);
    //console.log(new Date(), data, ...args);  // logger подключен к консоли
  }
}

// Логирование информационных сообщений
logInfo(data, ...args) {
  if (this.debugLevel==='Info' || this.debugLevel==='Debug')
  {
    this.logger.log(data, ...args);
    //console.log(new Date(), data, ...args);  // logger подключен к консоли
  }
}

// Логирование отладочных сообщений
logDebug(data, ...args) {
  if (this.debugLevel==='Debug') {
    this.logger.log(data, ...args);
    //console.log(new Date(), data, ...args);  // logger подключен к консоли
  }
}


}  // class

module.exports = Logger;
