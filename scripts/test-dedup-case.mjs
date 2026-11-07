import { checkLeadDuplicate, normalizePhone } from '../cloudflare/prospect-worker/src/deduplication/leadDeduplicator.js';

const candidate = {
  name: "Terrerio lucas",
  city: "Suzano",
  state: "SP",
  address: "Rua Passos, 469 · Cidade Edson · Suzano - SP · CEP 08665-410, Cidade Edson",
  phone: "11912276156",
  google_place_id: null,
};

const existing = [
  {
    id: "b7e1cb36-3277-4480-afa8-6609f2454160",
    name: "Terrerio lucas",
    city: "Suzano",
    address: "Rua Passos, 469 · Cidade Edson · Suzano - SP · CEP 08665-410, Cidade Edson",
    phone: "11912276156",
    phone_normalized: "5511912276156",
  }
];

console.log('candPhone norm:', normalizePhone(candidate.phone));
console.log('existPhone norm:', normalizePhone(existing[0].phone_normalized || existing[0].phone));

const res = checkLeadDuplicate(candidate, existing);
console.log('Result:', res);
