const TRACK_KEY = "axecloud_activity_tracked";

/** Regista uma visita/sessão em access_logs (best-effort). */
export async function trackSessionActivity(accessToken: string): Promise<void> {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const marker = `${TRACK_KEY}:${day}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    await fetch("/api/metrics/track-activity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    /* métricas não devem bloquear o app */
  }
}
