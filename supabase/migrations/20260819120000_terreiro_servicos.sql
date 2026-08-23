-- Adiciona campo de WhatsApp dedicado para atendimentos na tabela de terreiros
ALTER TABLE terreiros_diretorio
  ADD COLUMN IF NOT EXISTS whatsapp_atendimento TEXT;

-- Tabela de serviços/atendimentos oferecidos por cada terreiro
CREATE TABLE IF NOT EXISTS terreiro_servicos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terreiro_id     UUID NOT NULL REFERENCES terreiros_diretorio(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  duracao_minutos INT,
  valor_min       NUMERIC(10,2),
  valor_max       NUMERIC(10,2),
  disponivel      BOOLEAN NOT NULL DEFAULT true,
  ordem           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS terreiro_servicos_terreiro_id_idx ON terreiro_servicos(terreiro_id);
CREATE INDEX IF NOT EXISTS terreiro_servicos_disponivel_idx ON terreiro_servicos(terreiro_id, disponivel);

-- Trigger para manter updated_at
CREATE OR REPLACE FUNCTION set_updated_at_terreiro_servicos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_terreiro_servicos_updated_at ON terreiro_servicos;
CREATE TRIGGER trg_terreiro_servicos_updated_at
  BEFORE UPDATE ON terreiro_servicos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_terreiro_servicos();

-- RLS
ALTER TABLE terreiro_servicos ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer pessoa pode ver serviços disponíveis
CREATE POLICY "terreiro_servicos_public_read"
  ON terreiro_servicos FOR SELECT
  USING (disponivel = true);

-- Zelador autenticado pode ver todos os próprios (incluindo indisponíveis) e escrever
CREATE POLICY "terreiro_servicos_owner_all"
  ON terreiro_servicos FOR ALL
  USING (
    terreiro_id IN (
      SELECT id FROM terreiros_diretorio
      WHERE claimed_by_tenant_id = auth.uid()
    )
  )
  WITH CHECK (
    terreiro_id IN (
      SELECT id FROM terreiros_diretorio
      WHERE claimed_by_tenant_id = auth.uid()
    )
  );
