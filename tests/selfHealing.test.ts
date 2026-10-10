import test from "node:test";
import assert from "node:assert/strict";
import {
  diagnoseAndVerifyFailure,
  runSelfHealingTick,
  type TenantFailureRecord,
} from "../api/lib/selfHealing.js";

test("selfHealing: diagnostica e auto-resolve falha transitória de gateway/docker quando banco responde", async () => {
  const fakeSb: any = {
    from: (table: string) => ({
      select: () => ({
        limit: async () => ({
          data: [{ id: "lider-123" }],
          error: null,
        }),
      }),
    }),
  };

  const failure: TenantFailureRecord = {
    id: "fail-1",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    tenant_id: null,
    feature: "api",
    route: "docker:deploy-app-1",
    http_status: 504,
    source: "docker_logs",
    error_message: "Gateway Timeout",
  };

  const result = await diagnoseAndVerifyFailure(fakeSb, failure);
  assert.equal(result.isHealed, true);
  assert.match(result.reason, /transitória/i);
});

test("selfHealing: valida falha de agenda quando tabela calendario_axe está saudável", async () => {
  const fakeSb: any = {
    from: (table: string) => {
      assert.equal(table, "calendario_axe");
      return {
        select: () => ({
          or: () => ({
            limit: async () => ({
              data: [],
              error: null,
            }),
          }),
        }),
      };
    },
  };

  const failure: TenantFailureRecord = {
    id: "fail-agenda",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    tenant_id: "tenant-abc",
    feature: "agenda",
    route: "/dashboard",
    http_status: 500,
    source: "client_telemetry",
    error_message: "HTTP 500",
    metadata: {
      action: "GET /api/events?tenantId=tenant-abc&scope=calendar",
    },
  };

  const result = await diagnoseAndVerifyFailure(fakeSb, failure);
  assert.equal(result.isHealed, true);
  assert.match(result.reason, /Agenda/i);
});

test("selfHealing: não cura quando consulta da tabela continua retornando erro persistente", async () => {
  const fakeSb: any = {
    from: (table: string) => ({
      select: () => ({
        or: () => ({
          limit: async () => ({
            data: null,
            error: { message: "relation does not exist" },
          }),
        }),
      }),
    }),
  };

  const failure: TenantFailureRecord = {
    id: "fail-broken",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    tenant_id: "tenant-abc",
    feature: "agenda",
    route: "/dashboard",
    http_status: 500,
    source: "client_telemetry",
    error_message: "HTTP 500",
    metadata: {
      action: "GET /api/events?tenantId=tenant-abc",
    },
  };

  const result = await diagnoseAndVerifyFailure(fakeSb, failure);
  assert.equal(result.isHealed, false);
  assert.match(result.reason, /persistente/i);
});

test("selfHealing: runSelfHealingTick processa lote e atualiza no banco com metadados", async () => {
  const updatedRows: any[] = [];
  const fakeFailures = [
    {
      id: "f-1",
      created_at: new Date(Date.now() - 60_000).toISOString(),
      tenant_id: "tenant-123",
      feature: "agenda",
      route: "/dashboard",
      http_status: 500,
      source: "client_telemetry",
      error_message: "HTTP 500",
      metadata: { action: "GET /api/events" },
    },
  ];

  const fakeSb: any = {
    from: (table: string) => {
      if (table === "tenant_feature_failures") {
        return {
          select: () => ({
            is: () => ({
              order: () => ({
                limit: async () => ({
                  data: fakeFailures,
                  error: null,
                }),
              }),
            }),
          }),
          update: (fields: any) => ({
            eq: async (col: string, val: string) => {
              updatedRows.push({ col, val, fields });
              return { error: null };
            },
          }),
        };
      }
      if (table === "calendario_axe") {
        return {
          select: () => ({
            or: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    },
  };

  const tickResult = await runSelfHealingTick(fakeSb);
  assert.equal(tickResult.ok, true);
  assert.equal(tickResult.checked, 1);
  assert.equal(tickResult.resolved, 1);
  assert.equal(updatedRows.length, 1);
  assert.equal(updatedRows[0].fields.metadata.auto_healed, true);
  assert.equal(updatedRows[0].fields.metadata.resolved_by, "self_healing_runner");
});
