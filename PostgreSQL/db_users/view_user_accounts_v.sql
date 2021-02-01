create or replace view users.user_accounts_v as
select 
  u.user_id
, u.user_login
, u.created_date user_created_date
, a.account_address
, a.account_name
, a.encrypted_key
, a.created_date account_created_date
from users.users_t u
join users.accounts_t a on a.user_id = u.user_id; 

grant select on users.user_accounts_v to nodejs;
