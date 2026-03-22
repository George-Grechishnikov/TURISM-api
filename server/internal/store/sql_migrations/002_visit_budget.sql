-- Ориентировочная стоимость визита (фильтр по бюджету из опроса); NULL = не задано, не фильтруем
ALTER TABLE places_place
  ADD COLUMN IF NOT EXISTS typical_visit_cost_rub INTEGER NULL;
