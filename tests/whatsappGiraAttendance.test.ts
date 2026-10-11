import assert from "node:assert/strict";
import test from "node:test";
import {
  detectGiraAttendanceAction,
  resolveGiraAttendanceTarget,
  applyGiraAttendanceResponse,
  handleGiraAttendanceInbound,
} from "../api/lib/whatsappGiraAttendanceHandler.ts";

function createMockQuery(resolvedData: any) {
  const query: any = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    or: () => query,
    gte: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: resolvedData, error: null }),
    single: async () => ({ data: resolvedData, error: null }),
    update: (payload: any) => {
      query._lastUpdated = payload;
      return query;
    },
    insert: (payload: any) => {
      query._lastInserted = payload;
      return Promise.resolve({ error: null });
    },
  };
  return query;
}

test("detectGiraAttendanceAction reconhece confirmação de presença (botões e texto)", () => {
  assert.equal(detectGiraAttendanceAction("Confirmar presença"), "confirmado");
  assert.equal(detectGiraAttendanceAction("Confirmar presenca"), "confirmado");
  assert.equal(detectGiraAttendanceAction("confirmar"), "confirmado");
  assert.equal(detectGiraAttendanceAction("VOU SIM"), "confirmado");
  assert.equal(detectGiraAttendanceAction("estarei presente"), "confirmado");
  assert.equal(detectGiraAttendanceAction("Sim, vou"), "confirmado");
});

test("detectGiraAttendanceAction reconhece ausência / recusa (botões e texto)", () => {
  assert.equal(detectGiraAttendanceAction("Não poderei ir"), "recusado");
  assert.equal(detectGiraAttendanceAction("Nao poderei ir"), "recusado");
  assert.equal(detectGiraAttendanceAction("não vou"), "recusado");
  assert.equal(detectGiraAttendanceAction("nao vou poder"), "recusado");
  assert.equal(detectGiraAttendanceAction("ausente"), "recusado");
  assert.equal(detectGiraAttendanceAction("recusar"), "recusado");
});

test("detectGiraAttendanceAction ignora mensagens não relacionadas", () => {
  assert.equal(detectGiraAttendanceAction("Olá, boa tarde!"), null);
  assert.equal(detectGiraAttendanceAction("Qual o valor da mensalidade?"), null);
  assert.equal(detectGiraAttendanceAction("Obrigado"), null);
});

test("resolveGiraAttendanceTarget resolve via contextId de whatsapp_logs com event_id", async () => {
  const mockSb: any = {
    from: (table: string) => {
      if (table === "whatsapp_logs") {
        return createMockQuery({
          tenant_id: "tenant-abc",
          filho_id: "filho-xyz",
          mensagem: "Gira de Ogum [event_id:event-456]",
          tipo: "aviso_gira",
        });
      }
      if (table === "calendario_axe") {
        return createMockQuery({
          id: "event-456",
          titulo: "Gira de Ogum",
          data: "2026-10-15",
          hora: "20:00",
        });
      }
      return createMockQuery(null);
    },
  };

  const target = await resolveGiraAttendanceTarget(mockSb, "5511999998888", "wamid.msg123");
  assert.ok(target);
  assert.equal(target.tenantId, "tenant-abc");
  assert.equal(target.filhoId, "filho-xyz");
  assert.equal(target.eventId, "event-456");
  assert.equal(target.tituloEvento, "Gira de Ogum");
});

test("applyGiraAttendanceResponse atualiza presença existente em evento_participantes", async () => {
  let updatedPayload: any = null;
  const mockSb: any = {
    from: (table: string) => {
      assert.equal(table, "evento_participantes");
      const q = createMockQuery({ id: "part-1", status: "pendente" });
      q.update = (payload: any) => {
        updatedPayload = payload;
        return q;
      };
      return q;
    },
  };

  const res = await applyGiraAttendanceResponse(
    mockSb,
    {
      tenantId: "tenant-1",
      filhoId: "filho-1",
      eventId: "event-1",
    },
    "confirmado"
  );

  assert.equal(res.success, true);
  assert.equal(res.status, "confirmado");
  assert.equal(updatedPayload.status, "confirmado");
  assert.ok(updatedPayload.responded_at);
});

test("applyGiraAttendanceResponse insere presença se ainda não existia", async () => {
  let insertedPayload: any = null;
  const mockSb: any = {
    from: (table: string) => {
      assert.equal(table, "evento_participantes");
      const q = createMockQuery(null);
      q.insert = (payload: any) => {
        insertedPayload = payload;
        return Promise.resolve({ error: null });
      };
      return q;
    },
  };

  const res = await applyGiraAttendanceResponse(
    mockSb,
    {
      tenantId: "tenant-1",
      filhoId: "filho-1",
      eventId: "event-1",
    },
    "recusado"
  );

  assert.equal(res.success, true);
  assert.equal(res.status, "recusado");
  assert.equal(insertedPayload.status, "recusado");
  assert.equal(insertedPayload.justificativa, "Informou ausência via WhatsApp");
  assert.ok(insertedPayload.checkin_token);
});

test("handleGiraAttendanceInbound coordena ação, gravação e retorno", async () => {
  let updatedStatus: string | null = null;
  const mockSb: any = {
    from: (table: string) => {
      if (table === "whatsapp_logs") {
        return createMockQuery({
          tenant_id: "tenant-1",
          filho_id: "filho-1",
          mensagem: "Gira [event_id:event-1]",
          tipo: "aviso_gira",
        });
      }
      if (table === "calendario_axe") {
        return createMockQuery({
          id: "event-1",
          titulo: "Gira de Caboclo",
        });
      }
      if (table === "evento_participantes") {
        const q = createMockQuery({ id: "p1", status: "pendente" });
        q.update = (p: any) => {
          updatedStatus = p.status;
          return q;
        };
        return q;
      }
      return createMockQuery(null);
    },
  };

  const result = await handleGiraAttendanceInbound(mockSb, {
    from: "5511999998888",
    body: "Confirmar presença",
    messageType: "button",
    raw: { context: { id: "wamid.msg1" } },
  });

  assert.equal(result.handled, true);
  assert.equal(result.action, "confirmado");
  assert.equal(result.eventId, "event-1");
  assert.equal(result.filhoId, "filho-1");
  assert.equal(updatedStatus, "confirmado");
});
