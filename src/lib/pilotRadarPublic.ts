import type { GiraScheduleItem } from '../../lib/giraSchedule';
import {formatGiraTime} from '../../lib/giraSchedule';
export type PilotRadarPublic={
 showAddress:boolean;coverPosition:'top'|'center'|'bottom';
 cover:{source:string;caption:string;illustrative:boolean}|null;
 portrait:{source:string;caption:string;illustrative:boolean}|null;
 gallery:{id:string;source:string;caption:string;illustrative:boolean}[];
 socials:{id:string;network:'instagram'|'facebook'|'tiktok'|'youtube'|'website';url:string}[];
};
export const pilotNetworkNames={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube',website:'Site da casa'};
export function publicGiraTime(item:GiraScheduleItem&{horarioFim?:string}){
 return formatGiraTime(item.horario)+(item.horarioFim?` – ${formatGiraTime(item.horarioFim)}${item.horarioFim<=item.horario?' (dia seguinte)':''}`:'');
}
export function publicRadarCaption(p:PilotRadarPublic|undefined,url:string){
 if(!p)return '';
 const media=[p.cover,p.portrait,...p.gallery].find(m=>m?.source===url);
 return [media?.caption,media?.illustrative?'Imagem ilustrativa · IA':''].filter(Boolean).join(' · ');
}
