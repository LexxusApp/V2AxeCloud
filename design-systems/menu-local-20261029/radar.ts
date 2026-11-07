import { demoRadar, type LocalRadar, type RadarMedia } from './completion';
import patio from './assets/gallery/patio-v1.webp';
import flores from './assets/gallery/flores-v1.webp';
export const radarExampleMedia:RadarMedia[]=[{id:'radar-patio',source:patio,caption:'Espaço ilustrativo. Imagem gerada por IA para o protótipo.',illustrative:true},{id:'radar-flores',source:flores,caption:'Flores de exemplo. Imagem gerada por IA; não é registro real de uma casa.',illustrative:true}];
export const demoRadarStudio:LocalRadar={...demoRadar,cover:{...radarExampleMedia[0]},gallery:radarExampleMedia.map(m=>({...m})),schedules:[{id:'radar-saturday',day:6,start:'20:00',end:'22:00',title:'Encontro da casa de exemplo',enabled:true}]};
