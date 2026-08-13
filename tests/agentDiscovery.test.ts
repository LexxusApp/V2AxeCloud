import assert from "node:assert/strict";
import test from "node:test";
import {
  API_CATALOG_PROFILE,
  API_CATALOG_TYPE,
  buildPublicApiCatalog,
  buildPublicOpenApiSpec,
} from "../api/lib/agentDiscovery.ts";

test("catálogo RFC 9727 aponta spec e docs públicas", () => {
  const catalog = buildPublicApiCatalog();
  assert.ok(Array.isArray(catalog.linkset));
  assert.ok(catalog.linkset.length >= 1);
  const first = catalog.linkset[0];
  assert.match(first.anchor, /^https:\/\/axecloud\.com\.br\/api\/v1\/public\//);
  assert.equal(first["service-desc"][0].href, "https://axecloud.com.br/openapi.json");
  assert.match(API_CATALOG_TYPE, /application\/linkset\+json/);
  assert.equal(API_CATALOG_PROFILE, "https://www.rfc-editor.org/info/rfc9727");
});

test("OpenAPI pública descreve diretório e eventos sem rotas autenticadas", () => {
  const spec = buildPublicOpenApiSpec();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/api/v1/public/diretorio/cidades"]);
  assert.ok(spec.paths["/api/v1/public/eventos"]);
  assert.equal(spec.paths["/api/v1/auth/login"], undefined);
  assert.equal(spec.paths["/dashboard"], undefined);
});
