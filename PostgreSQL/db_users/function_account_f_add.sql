CREATE OR REPLACE FUNCTION users.account_f_add(
  in i_user_id         integer
, in i_account_address bytea
, in i_account_name    varchar
, in i_encrypted_key   json
, in i_salt            bytea
) 
RETURNS varchar AS $$
-- Добавляет учетную запись пользователя в БД
declare
  l_created_date timestamp;
begin
  if i_user_id is null 
  or i_account_address is null or length(i_account_address) = 0 
  or i_encrypted_key   is null 
  or i_account_name is null
  or i_salt is null
  then
    return '{"error":{"code":-2002,"message":"Не заданы входные параметры"}}';
  end if;
  if length(i_account_address) != 40 then
    return '{"error":{"code":-2003,"message":"Адрес аккаунта должен содержать 40 цифр в hex-формате"}}';
  end if;
  if length(i_account_name) > 255 then
    return '{"error":{"code":-2004,"message":"Имя аккаунта не должно превышать 255 символов"}}';
  end if;
  
  -- Время сохраняется в UTC
  l_created_date := CURRENT_TIMESTAMP(0);
  insert into users.accounts_t(
      user_id
    , account_address
    , account_name
    , encrypted_key
    , created_date
    , salt
  )
  values(
      i_user_id
    , i_account_address
    , i_account_name
    , i_encrypted_key
    , l_created_date
    , i_salt
  );
  return '{"createdDate":"'||to_char(l_created_date,'YYYY-MM-DD HH24:MI:SS')||'"}';
exception 
  when unique_violation then
    return '{"error":{"code":-2001,"message":"Аккаунт с данным адресом или именем уже существует"}}';
  when others then
    return '{"error":{"code":-2000,"message": "'||SQLSTATE||' '||SQLERRM||'"}}';
end;
$$ LANGUAGE plpgsql;
