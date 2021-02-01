CREATE or REPLACE FUNCTION users.user_f_add(
  in i_realm  varchar,
  in i_user_login  varchar
) 
RETURNS json AS $$
-- Добавляет пользователя в БД
-- Время сохраняется в UTC
declare
  l_realm varchar;
  l_created_date timestamp;
begin
  if i_realm is null or i_user_login is null 
  or length(i_realm) = 0 or length(i_user_login) = 0
  then
    return '{"error":{"code":-2002,"message":"Не заданы обяязательные параметры"}}';
  end if;
  if length(i_user_login) < 8 or length(i_user_login) > 255 then
    return '{"error":{"code":-2003,"message":"Логин должен быть от 8 до 255 символов"}}';
  end if;
  l_realm := regexp_replace(i_realm, '[_0-9a-zA-Z.-]', '', 'ign');
  if length(l_realm) > 0 then
    return '{"error":{"code":-2004,"message":"Допустимые символы в реалме: цифры, латинские буквы, точка, подчеркивание и прочерк"}}';
  end if;
  
  -- Время сохраняется в UTC
  -- Формат сохранения даты не менять! Он учавствует в получении пароля
  l_created_date := CURRENT_TIMESTAMP(0);
  insert into users.users_t(realm, user_login, created_date)
  values(i_realm, i_user_login, l_created_date);
  
  return '{"createdDate":"'||to_char(l_created_date,'YYYY-MM-DD HH24:MI:SS')||'"}';
exception 
  when unique_violation then
    return '{"error":{"code":-2001,"message":"Пользователь с данным реалмом и логином уже существует"}}';
  when others then
    return '{"error":{"code":-2000,"message": "'||SQLSTATE||' '||SQLERRM||'"}}';
end;
$$ LANGUAGE plpgsql;

