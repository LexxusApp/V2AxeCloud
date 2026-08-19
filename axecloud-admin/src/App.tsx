import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { apiJson, isApiUnreachable, setAccessToken } from "./lib/api";
import { LoginPage } from "./pages/LoginPage";
import { CommandShell } from "./pages/CommandShell";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [consoleOk, setConsoleOk] = useState(false);
  /** API em :3000 inacessível vs. sessão válida mas sem permissão no console */
  const [consoleGate, setConsoleGate] = useState<"network" | "forbidden" | null>(null);
  const consoleOkRef = useRef(false);
  const verifyingRef = useRef(false);

  const verifyConsole = useCallback(async (s: Session) => {
    if (verifyingRef.current || consoleOkRef.current) {
      setAccessToken(s.access_token);
      return;
    }
    verifyingRef.current = true;
    setAccessToken(s.access_token);
    try {
      await apiJson<{ ok: boolean }>("/api/admin-console/session", {
        signal: AbortSignal.timeout(8_000),
      });
      consoleOkRef.current = true;
      setConsoleOk(true);
      setConsoleGate(null);
    } catch (e) {
      consoleOkRef.current = false;
      setConsoleOk(false);
      setAccessToken(null);
      setConsoleGate(isApiUnreachable(e) ? "network" : "forbidden");
    } finally {
      verifyingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s);
      if (s?.access_token) void verifyConsole(s);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (!s?.access_token) {
        consoleOkRef.current = false;
        setConsoleOk(false);
        setAccessToken(null);
        return;
      }
      setAccessToken(s.access_token);
      if (consoleOkRef.current || verifyingRef.current) return;
      if (event === "SIGNED_IN") return;
      void verifyConsole(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [verifyConsole]);

  const onAuthed = useCallback(async (s: Session) => {
    setAccessToken(s.access_token);
    consoleOkRef.current = true;
    setSession(s);
    setConsoleOk(true);
    setConsoleGate(null);
  }, []);

  if (!supabase) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-center text-[var(--ac-text-muted)] bg-[var(--ac-paper)]">
        Defina <span className="font-semibold text-[var(--ac-text)]">VITE_SUPABASE_URL</span> e{" "}
        <span className="font-semibold text-[var(--ac-text)]">VITE_SUPABASE_ANON_KEY</span> no{" "}
        <span className="font-mono text-sm">axecloud-admin/.env</span>.
      </div>
    );
  }

  if (booting) {
    return (
      <div className="flex min-h-full items-center justify-center text-neutral-500">
        A carregar…
      </div>
    );
  }

  if (!session || !consoleOk) {
    return (
      <LoginPage session={session} consoleGate={consoleGate} onAuthed={onAuthed} />
    );
  }

  return <CommandShell session={session} />;
}
