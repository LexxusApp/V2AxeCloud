import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

test('aba Disparo de gira renderiza sem acessar callbacks antes da inicialização', () => {
  const source = readFileSync(new URL('../axecloud-admin/src/pages/GiraDispatchPanel.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const require = createRequire(import.meta.url);
  const exports: { GiraDispatchPanel?: ComponentType } = {};
  let apiCalls = 0;
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === '@/lib/api') return { apiJson: () => { apiCalls++; throw new Error('API não deve ser chamada durante renderização.'); } };
      if (name === '@/lib/cn') return { cn: (...classes: unknown[]) => classes.filter(Boolean).join(' ') };
      return require(name);
    },
  });
  assert.ok(exports.GiraDispatchPanel);
  const html = renderToStaticMarkup(createElement(exports.GiraDispatchPanel));
  assert.match(html, /Disparo de gira/);
  assert.match(html, /<select/);
  assert.equal(apiCalls, 0);
});
