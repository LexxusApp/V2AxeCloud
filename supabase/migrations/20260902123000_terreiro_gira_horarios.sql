ALTER TABLE public.terreiros_diretorio
  ADD COLUMN IF NOT EXISTS gira_horarios JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.terreiros_diretorio
  DROP CONSTRAINT IF EXISTS terreiros_diretorio_gira_horarios_array;

ALTER TABLE public.terreiros_diretorio
  ADD CONSTRAINT terreiros_diretorio_gira_horarios_array
  CHECK (jsonb_typeof(gira_horarios) = 'array');

COMMENT ON COLUMN public.terreiros_diretorio.gira_horarios IS
  'Horários semanais habituais de giras publicados pelo responsável da casa.';
