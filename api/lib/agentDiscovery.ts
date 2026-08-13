import type { Express, Request, Response } from "express";

export const SITE_ORIGIN = "https://axecloud.com.br";
export const API_CATALOG_PROFILE = "https://www.rfc-editor.org/info/rfc9727";
export const API_CATALOG_TYPE = `application/linkset+json; profile="${API_CATALOG_PROFILE}"`;

export function buildPublicApiCatalog() {
  return {
    linkset: [
      {
        anchor: `${SITE_ORIGIN}/api/v1/public/diretorio`,
        "service-desc": [
          {
            href: `${SITE_ORIGIN}/openapi.json`,
            type: "application/vnd.oai.openapi+json;version=3.1",
          },
        ],
        "service-doc": [
          {
            href: `${SITE_ORIGIN}/llms.txt`,
            type: "text/plain",
          },
          {
            href: `${SITE_ORIGIN}/terreiros`,
            type: "text/html",
          },
        ],
      },
      {
        anchor: `${SITE_ORIGIN}/api/v1/public/terreiros`,
        "service-desc": [
          {
            href: `${SITE_ORIGIN}/openapi.json`,
            type: "application/vnd.oai.openapi+json;version=3.1",
          },
        ],
        "service-doc": [
          {
            href: `${SITE_ORIGIN}/terreiros`,
            type: "text/html",
          },
        ],
      },
      {
        anchor: `${SITE_ORIGIN}/api/v1/public/eventos`,
        "service-desc": [
          {
            href: `${SITE_ORIGIN}/openapi.json`,
            type: "application/vnd.oai.openapi+json;version=3.1",
          },
        ],
        "service-doc": [
          {
            href: `${SITE_ORIGIN}/eventos`,
            type: "text/html",
          },
        ],
      },
    ],
  };
}

export function buildPublicOpenApiSpec() {
  const serverUrl = SITE_ORIGIN;
  return {
    openapi: "3.1.0",
    info: {
      title: "AxéCloud Public API",
      description:
        "APIs públicas de descoberta: diretório de terreiros, perfis públicos e eventos. Não inclui o painel autenticado.",
      version: "1.0.0",
      contact: { url: serverUrl },
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/api/v1/public/diretorio/cidades": {
        get: {
          summary: "Cidades do diretório público",
          operationId: "listDiretorioCidades",
          responses: { "200": { description: "Lista de cidades com terreiros" } },
        },
      },
      "/api/v1/public/diretorio/{estado}/{cidade}": {
        get: {
          summary: "Terreiros de uma cidade no diretório",
          operationId: "listDiretorioCidade",
          parameters: [
            { name: "estado", in: "path", required: true, schema: { type: "string", example: "sp" } },
            { name: "cidade", in: "path", required: true, schema: { type: "string", example: "sao-paulo" } },
          ],
          responses: { "200": { description: "Terreiros da cidade" } },
        },
      },
      "/api/v1/public/diretorio/terreiro/{slug}": {
        get: {
          summary: "Ficha pública de um terreiro do diretório",
          operationId: "getDiretorioTerreiro",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Terreiro" }, "404": { description: "Não encontrado" } },
        },
      },
      "/api/v1/public/terreiros": {
        get: {
          summary: "Casas com portal público ativo",
          operationId: "listTerreirosPublicos",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 48 } },
          ],
          responses: { "200": { description: "Lista paginada de terreiros" } },
        },
      },
      "/api/v1/public/terreiros/{slug}": {
        get: {
          summary: "Perfil público de uma casa",
          operationId: "getTerreiroPublico",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Perfil" }, "404": { description: "Não encontrado" } },
        },
      },
      "/api/v1/public/eventos": {
        get: {
          summary: "Eventos públicos próximos",
          operationId: "listEventosPublicos",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 60 } },
            { name: "cidade", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Lista de eventos" } },
        },
      },
      "/api/health-check": {
        get: {
          summary: "Saúde do serviço",
          operationId: "healthCheck",
          responses: { "200": { description: "Serviço no ar" } },
        },
      },
    },
  };
}

const CATALOG_LINK = `</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`;

function sendJsonDocument(req: Request, res: Response, body: unknown, contentType: string) {
  const json = JSON.stringify(body);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Link", CATALOG_LINK);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Length", Buffer.byteLength(json).toString());
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  res.status(200).send(json);
}

export function registerAgentDiscoveryRoutes(app: Express) {
  const sendCatalog = (req: Request, res: Response) => {
    sendJsonDocument(req, res, buildPublicApiCatalog(), API_CATALOG_TYPE);
  };
  const sendOpenApi = (req: Request, res: Response) => {
    sendJsonDocument(req, res, buildPublicOpenApiSpec(), "application/vnd.oai.openapi+json;version=3.1");
  };

  app.get("/.well-known/api-catalog", sendCatalog);
  app.head("/.well-known/api-catalog", sendCatalog);
  app.get("/openapi.json", sendOpenApi);
  app.head("/openapi.json", sendOpenApi);
}
