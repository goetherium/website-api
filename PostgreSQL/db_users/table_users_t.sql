create table users.users_t(
  user_id       serial        primary key,
  realm         varchar(30)   not null,
  user_login    varchar(255)  not null,
  created_date  timestamptz   not null
);
comment on table users.users_t is 'Пользователи внешнего приложения';
comment on column users.users_t.user_id is 'Внутренний ID пользователя';
comment on column users.users_t.user_login is 'Логин пользователя во внешнем приложении, м..б. зашифрован';
comment on column users.users_t.created_date is 'Дата создания логина с учётом зоны';

create unique index users_i_uq_realm_login on users.users_t(realm, user_login);

-- Права на вызов функции не достаточно, нужны прямые права на таблицу
grant select, insert on users.users_t to nodejs;
grant usage on users.users_t_user_id_seq to nodejs;

-- ограничения на таблицу
SELECT *
FROM information_schema.constraint_table_usage
WHERE table_name = 'users.users_t';
