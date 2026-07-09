-- Нормализация существующих РФ-телефонов к E.164 (+79XXXXXXXXX):
-- вход по телефону ищет точное совпадение, поэтому «8 (916) …» в БД не найдётся.
-- Пропускаем строки, где нормализованный номер уже занят другим аккаунтом
-- (иначе упрёмся в unique) — такие разруливаются вручную.
UPDATE users u
SET phone = '+7' || right(regexp_replace(u.phone, '\D', '', 'g'), 10),
    updated_at = now()
WHERE u.phone IS NOT NULL
  AND regexp_replace(u.phone, '\D', '', 'g') ~ '^(7|8)?9\d{9}$'
  AND u.phone <> '+7' || right(regexp_replace(u.phone, '\D', '', 'g'), 10)
  AND NOT EXISTS (
    SELECT 1 FROM users o
    WHERE o.id <> u.id
      AND o.phone = '+7' || right(regexp_replace(u.phone, '\D', '', 'g'), 10)
  );
