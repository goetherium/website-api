create table users.accounts_t(
  user_id         integer constraint accounts_user_id_fk 
                  REFERENCES users.users_t (user_id) 
                  ON DELETE RESTRICT
                  ON UPDATE RESTRICT,
  account_address bytea        not null,
  account_name    varchar(255) not null,
  encrypted_key   json         not null,
  created_date    timestamptz  not null,
  salt            bytea
);
comment on table users.accounts_t is 'Хранилище зашифрованных закрытых ключей для аккаунтов Ethereum';
comment on column users.accounts_t.user_id is 'Внутренний ID пользователя, users.users_t.user_id';
comment on column users.accounts_t.account_address is 'Адрес аккаунта Ethereum (hex)';
comment on column users.accounts_t.account_name is 'Пользовательское наименование аккаунта';
comment on column users.accounts_t.encrypted_key is 'Зашифрованный закрытый ключ в формате JSON';
comment on column users.accounts_t.created_date is 'Дата создания аккаунта с учетом зоны';
comment on column users.accounts_t.salt is 'Соль пароля шифрования аккаунта';

create unique index accounts_i_uq_acc on users.accounts_t(account_address);
create unique index accounts_i_uq2 on users.accounts_t(user_id, account_name);

-- Права на вызов функции не достаточно, нужны прямые права на таблицу
grant select, insert on users.accounts_t to nodejs;

