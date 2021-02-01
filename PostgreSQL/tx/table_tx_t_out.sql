create table tx.tx_t_out(
  tx_hash         bytea primary key,
  source_address  bytea not null,
  dest_address    bytea not null,
  created_date    timestamptz not null,
  wei_value       numeric
);
comment on table  tx.tx_t_out is 'Транзакции, отправленные аккаунтом';
comment on column tx.tx_t_out.tx_hash is 'Хэш транзакции';
comment on column tx.tx_t_out.source_address is 'Адрес аккаунта - д.б. в БД';
comment on column tx.tx_t_out.dest_address is 'Адрес получателя - м.б. произвольным';
comment on column tx.tx_t_out.created_date is 'Дата отправки транзакции в сеть с учётом зоны';
comment on column tx.tx_t_out.wei_value is 'Сумма транзакции в wei';

-- Права на вызов функции не достаточно, нужны прямые права на таблицу
grant select, insert on tx.tx_t_out to nodejs;

create index tx_i_out_from on tx.tx_t_out(source_address);
create index tx_i_out_to on tx.tx_t_out(dest_address);


