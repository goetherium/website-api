create or replace view tx.txs_out_v as
select 
-- список исх. транзакций, запрос идет по полю source_address
  su.realm source_realm
, su.user_login source_user_login
, tx.source_address
, du.user_login dest_user_login
, tx.dest_address
, tx.tx_hash
, tx.created_date tx_created_date
, tx.wei_value
from tx.tx_t_out tx
join users.accounts_t sa on sa.account_address = tx.source_address
join users.users_t su on su.user_id = sa.user_id
-- получателя может не быть в БД
left outer join users.accounts_t da on da.account_address = tx.dest_address
left outer join users.users_t du on du.user_id = da.user_id
;

grant select on tx.txs_out_v to nodejs;
