-- Corrige trigger prevent_admin_escalation para permitir que superusers/postgres configurem admins globais
CREATE OR REPLACE FUNCTION public.prevent_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_admin_global = TRUE AND (OLD.is_admin_global = FALSE OR OLD.is_admin_global IS NULL) THEN
        IF current_user IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin') THEN
            RETURN NEW;
        END IF;
        IF NOT public.is_admin_global() THEN
            RAISE EXCEPTION 'Only global admins can grant global admin privileges.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
