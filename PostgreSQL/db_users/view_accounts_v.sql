create or replace view users.accounts_v as
select 
  user_id
, account_address
, account_name
, encrypted_key
, created_date account_created_date
, salt
from users.accounts_t;

grant select on users.accounts_v to nodejs;
