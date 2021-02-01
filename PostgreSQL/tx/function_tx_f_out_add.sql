CREATE OR REPLACE FUNCTION tx.tx_f_out_add (
  in i_tx_hash          bytea,
  in i_source_address   bytea,
  in i_dest_address     bytea,
  in i_wei_value        numeric
) 
RETURNS varchar AS $$
-- Добавляет отправленную аккаунтом транзакцию в БД
-- Время сохраняется локальное
declare
  l_created_date timestamp;
begin
  if i_tx_hash is null or i_source_address is null or i_dest_address is null then
    return '{"error":{"code":-2002,"message":"Не заданы входные параметры"}}';
  end if;
  if length(i_tx_hash) != 64 then
    return '{"error":{"code":-2003,"message":"Хэш транзакции должен содержать 64 цифр в hex-формате"}}';
  end if;
  if length(i_source_address) != 40 then
    return '{"error":{"code":-2004,"message":"Адрес аккаунта должен содержать 40 цифр в hex-формате"}}';
  end if;
  if length(i_dest_address) != 40 then
    return '{"error":{"code":-2005,"message":"Адрес получателя должен содержать 40 цифр в hex-формате"}}';
  end if;
  
  l_created_date := CURRENT_TIMESTAMP(0);
  insert into tx.tx_t_out(
      tx_hash
    , source_address
    , dest_address
    , created_date
    , wei_value
  )
  values(
      i_tx_hash
    , i_source_address
    , i_dest_address
    , l_created_date
    , i_wei_value
  );

  return '{"createdDate":"'||to_char(l_created_date,'YYYY-MM-DD HH24:MI:SS')||'"}';
exception 
  when unique_violation then
    return '{"error":{"code":-2001,"message":"Транзакция уже существует"}}';
  when others then
    return '{"error":{"code":-2000,"message": "'||SQLSTATE||' '||SQLERRM||'"}}';
end;
$$ LANGUAGE plpgsql;
