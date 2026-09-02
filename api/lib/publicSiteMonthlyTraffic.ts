import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingOrUnknownTable, isRememberedMissingTable } from "./adminConsoleAuth.js";
import { brazilDate } from "./brazilCalendar.js";

export type PublicSiteMonthlyVisitorRow = {
  month: string;
  label: string;
  visits: number;
  startsAt: string;
  endsAt: string;
  current: boolean;
};

export type PublicSiteMonthlyTraffic = {
  available: boolean;
  months: PublicSiteMonthlyVisitorRow[];
  totalVisits: number;
};

const MONTH_RE = /^(\d{4})-(\d{2})-\d{2}$/;

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function nextMonth(month: string): string {
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value, 1));
  return next.toISOString().slice(0, 7);
}

function monthEnd(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

/** Soma os visitantes únicos diários e preenche meses sem tráfego entre o primeiro registo e hoje. */
export function buildMonthlyVisitorSeries(
  rows: { visit_date?: string | null }[],
  now = new Date()
): PublicSiteMonthlyVisitorRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const visitDate = String(row.visit_date || "");
    const match = MONTH_RE.exec(visitDate);
    if (!match) continue;
    const month = `${match[1]}-${match[2]}`;
    counts.set(month, (counts.get(month) || 0) + 1);
  }

  const currentMonth = brazilDate(now).slice(0, 7);
  const recordedMonths = [...counts.keys()].sort();
  const firstMonth = recordedMonths[0] || currentMonth;
  const months: PublicSiteMonthlyVisitorRow[] = [];

  let cursor = firstMonth;
  let guard = 0;
  while (cursor <= currentMonth && guard < 240) {
    months.push({
      month: cursor,
      label: monthLabel(cursor),
      visits: counts.get(cursor) || 0,
      startsAt: `${cursor}-01`,
      endsAt: monthEnd(cursor),
      current: cursor === currentMonth,
    });
    cursor = nextMonth(cursor);
    guard++;
  }

  return months.reverse();
}

export async function fetchPublicSiteMonthlyTraffic(
  sb: SupabaseClient,
  now = new Date()
): Promise<PublicSiteMonthlyTraffic> {
  if (isRememberedMissingTable("public_site_visitors")) {
    return { available: false, months: [], totalVisits: 0 };
  }

  const rows: { visit_date?: string | null }[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("public_site_visitors")
      .select("visit_date, visitor_id")
      .order("visit_date", { ascending: true })
      .order("visitor_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (isMissingOrUnknownTable(error, "public_site_visitors")) {
        return { available: false, months: [], totalVisits: 0 };
      }
      throw error;
    }

    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  const months = buildMonthlyVisitorSeries(rows, now);
  return {
    available: true,
    months,
    totalVisits: months.reduce((total, month) => total + month.visits, 0),
  };
}
