-- Adiciona suporte a limite de crédito / caderneta da cantina e lojinha do terreiro
ALTER TABLE filhos_de_santo 
ADD COLUMN IF NOT EXISTS limite_lojinha NUMERIC DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS bloquear_fiado_loja BOOLEAN DEFAULT false;
