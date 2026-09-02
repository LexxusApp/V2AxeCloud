import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildMonthlyVisitorSeries } from "../api/lib/publicSiteMonthlyTraffic.js";
import { brazilDate, brazilMonthStart } from "../api/lib/brazilCalendar.js";

test("usa a data civil de São Paulo na virada do mês", () => {
  const instant = new Date("2026-09-01T02:30:00.000Z");
  assert.equal(brazilDate(instant), "2026-08-31");
  assert.equal(brazilMonthStart(instant), "2026-08-01");
});

test("agrupa visitas por mês civil e inclui agosto completo", () => {
  const series = buildMonthlyVisitorSeries(
    [
      { visit_date: "2026-08-01" },
      { visit_date: "2026-08-30" },
      { visit_date: "2026-08-31" },
      { visit_date: "2026-09-01" },
    ],
    new Date("2026-09-15T12:00:00.000Z")
  );

  assert.deepEqual(series.map(({ month, visits, startsAt, endsAt, current }) => ({ month, visits, startsAt, endsAt, current })), [
    { month: "2026-09", visits: 1, startsAt: "2026-09-01", endsAt: "2026-09-30", current: true },
    { month: "2026-08", visits: 3, startsAt: "2026-08-01", endsAt: "2026-08-31", current: false },
  ]);
});

test("painel usa o mês civil atual e oferece menu Visitantes", () => {
  const overview = fs.readFileSync("axecloud-admin/src/pages/OverviewPanel.tsx", "utf8");
  const layout = fs.readFileSync("axecloud-admin/src/pages/AdminDashboardLayout.tsx", "utf8");
  const shell = fs.readFileSync("axecloud-admin/src/pages/CommandShell.tsx", "utf8");
  const panel = fs.readFileSync("axecloud-admin/src/pages/VisitorsPanel.tsx", "utf8");
  const routes = fs.readFileSync("api/admin-console-routes.ts", "utf8");

  assert.match(overview, /label="Visitantes \(mês\)"/);
  assert.match(overview, /publicSiteVisitorsCurrentMonth/);
  assert.match(layout, /id: "visitors", label: "Visitantes"/);
  assert.match(shell, /tab === "visitors"/);
  assert.match(panel, /Visitantes por mês/);
  assert.match(routes, /\/api\/admin-console\/visitor-months/);
});
