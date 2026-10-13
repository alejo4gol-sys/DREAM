-- Tutoriales de cada sección: cuáles ya vio cada usuario (se muestran una sola vez, en cualquier dispositivo).
ALTER TABLE users ADD COLUMN tutorials_seen jsonb NOT NULL DEFAULT '[]'::jsonb;
