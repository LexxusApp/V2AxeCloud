import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyLoggedAppActor } from "../api/lib/loggedAppUsage.ts";

test("classifica zelador e filho para uso logado", () => {
  assert.equal(classifyLoggedAppActor("casa@email.com", "zelador"), "zelador");
  assert.equal(classifyLoggedAppActor("f_abc@axecloud.internal", "filho"), "filho");
  assert.equal(classifyLoggedAppActor("f_3ad2ad67-8cfb-4e8d-bd24-d091cf424ca4@axecloud.internal", null), "filho");
  assert.equal(classifyLoggedAppActor("x@y.com", "admin"), "other");
});

test("overview conta uso logado só de zelador/filho no mês", () => {
  const overview = fs.readFileSync("axecloud-admin/src/pages/OverviewPanel.tsx", "utf8");
  const handlers = fs.readFileSync("api/lib/adminConsoleHandlers.ts", "utf8");
  const traffic = fs.readFileSync("api/lib/publicSiteTraffic.ts", "utf8");

  assert.match(overview, /label="Uso logado \(mês\)"/);
  assert.match(overview, /loggedAppUsage/);
  assert.match(handlers, /fetchLoggedAppUsageStats/);
  assert.match(traffic, /fetchAllVisitDates/);
  assert.match(traffic, /VISITOR_PAGE/);
});
