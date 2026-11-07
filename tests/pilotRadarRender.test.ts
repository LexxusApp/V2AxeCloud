import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as gira from '../lib/giraSchedule';
import * as pilotPublic from '../src/lib/pilotRadarPublic';
import {pilotRadarDirectory} from '../cloudflare/pilot-radar-contract.js';
import {radarFixture} from './pilotRadar.fixture';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/views/portal/DiretorioTerreiroPage.tsx',import.meta.url),'utf8')+'\nexport {PhotosPanel,ContactPanel,AgendaPanel,ProfilePhoto,NextGiraCard};';
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const exports:any={};runInNewContext(compiled,{exports,require:(name:string)=>name==='../../../lib/giraSchedule'?gira:name==='../../lib/pilotRadarPublic'?pilotPublic:name.startsWith('.')?{}:require(name),Date,Intl,URL});
test('real public information panel renders all five saved networks and withholds hidden address',()=>{
 const p={...radarFixture(),showAddress:false};const terreiro=pilotRadarDirectory(p,{slug:'casa'});
 const html=renderToStaticMarkup(createElement(exports.ContactPanel,{terreiro,whatsappHref:null,onWhatsapp:()=>{}}));
 for(const network of ['Instagram','Facebook','TikTok','YouTube','Site da casa'])assert.ok(html.includes(network),network);
 for(const social of p.socials)assert.ok(html.includes(social.url),social.network);
 assert.match(html,/Endereço reservado/);for(const secret of [p.address,p.neighborhood,p.cep,p.latitude,p.mapsUrl])assert.equal(html.includes(secret),false,secret);
});
test('real public gallery renders saved Radar captions and excludes portrait and internal gallery',()=>{
 const p=radarFixture(),terreiro=pilotRadarDirectory(p,{slug:'casa'});const html=renderToStaticMarkup(createElement(exports.PhotosPanel,{terreiro}));
 assert.match(html,/Nossa entrada/);assert.match(html,/https:\/\/media.invalid\/gallery.jpg/);assert.doesNotMatch(html,/portrait.jpg|cover.jpg/);
});
test('real agenda and next meeting render final time across midnight; cover uses persisted position',()=>{
 const terreiro=pilotRadarDirectory(radarFixture(),{slug:'casa'});
 const agenda=renderToStaticMarkup(createElement(exports.AgendaPanel,{schedules:terreiro!.horariosGira,whatsappHref:null,onWhatsapp:()=>{}}));
 const next=renderToStaticMarkup(createElement(exports.NextGiraCard,{schedules:terreiro!.horariosGira,whatsappHref:null,onWhatsapp:()=>{},onOpenAgenda:()=>{}}));
 assert.match(agenda,/22h – 2h \(dia seguinte\)/);assert.match(next,/22h – 2h \(dia seguinte\)/);assert.doesNotMatch(agenda,/Encontro pausado/);
 const photo=renderToStaticMarkup(createElement(exports.ProfilePhoto,{fotoUrl:terreiro!.coverPhotoUrl,nome:terreiro!.nome,position:terreiro!.pilotRadar.coverPosition,caption:terreiro!.pilotRadar.cover.caption}));assert.match(photo,/object-position:top/);assert.match(photo,/alt="Capa da casa"/);
});
