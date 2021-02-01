create or replace view users.users_v as
select
  user_id
, user_login
, created_date
, realm
from users.users_t;

grant select on users.users_v to nodejs;
