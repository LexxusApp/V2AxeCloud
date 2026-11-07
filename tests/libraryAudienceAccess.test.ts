import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadLibraryPath, resolveLibraryReader, validateLibraryRecipients } from '../api/lib/libraryAudienceAccess.ts';
const house = '10000000-0000-4000-8000-000000000001';
const alias = '10000000-0000-4000-8000-000000000002';
const outside = '10000000-0000-4000-8000-000000000003';
const member = '20000000-0000-4000-8000-000000000001';
const sibling = '20000000-0000-4000-8000-000000000002';
const other = '20000000-0000-4000-8000-000000000003';
const authId = '30000000-0000-4000-8000-000000000001';
const siblingAuth = '30000000-0000-4000-8000-000000000002';
const otherAuth = '30000000-0000-4000-8000-000000000003';
function setup() {
  const tables: Record<string, any[]> = {
    perfil_lider: [{ id: house, tenant_id: alias, is_admin_global: false }, { id: outside, tenant_id: outside }, { id: authId, tenant_id: house, is_admin_global: false }],
    filhos_de_santo: [{ id: member, user_id: authId, tenant_id: alias, lider_id: house, email: 'member@example.invalid' }, { id: sibling, user_id: siblingAuth, tenant_id: house, lider_id: house }, { id: other, user_id: otherAuth, tenant_id: outside, lider_id: outside }],
    biblioteca: [{ id: 'private', storage_path: house + '/private.pdf', tenant_id: house, visibilidade: 'individual', destinatarios: [member] }, { id: 'shared', storage_path: house + '/shared.pdf', tenant_id: house, visibilidade: 'casa', destinatarios: [] }],
  };
  const client: any = {
    auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
    from(table: string) {
      let rows = [...(tables[table] || [])], columns = '*';
      const result = () => rows.map(row => columns === '*' ? row : Object.fromEntries(columns.split(',').map(key => [key.trim(), row[key.trim()]])));
      const q: any = {
        select: (value: string) => { columns = value; return q; },
        eq: (key: string, value: any) => { rows = rows.filter(row => row[key] === value); return q; },
        in: (key: string, values: any[]) => { rows = rows.filter(row => values.includes(row[key])); return q; },
        or: (value: string) => { rows = rows.filter(row => value.split(',').some(part => { const [key,, val] = part.split('.'); return String(row[key]) === val; })); return q; },
        order: () => q,
        range: (from: number, to: number) => { rows=rows.slice(from,to+1); return q; },
        maybeSingle: async () => ({ data: result()[0] || null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: result(), error: null }).then(resolve),
      };
      return q;
    },
  };
  return { client, tables };
}
test('perfil fantasma de líder não concede gestão ao membro; vínculo por e-mail conserva o ID destinatário', async () => {
  const { client } = setup();
  assert.deepEqual(await resolveLibraryReader(client, { id: authId, email: 'member@example.invalid' }, house), { manager: false, memberId: member });
  assert.deepEqual(await resolveLibraryReader(client, { id: '40000000-0000-4000-8000-000000000001', email: 'member@example.invalid' }, house), { manager: false, memberId: member });
});
test('download autoriza somente destinatário/casa corretos e mantém alias legítimo do terreiro', async () => {
  const { client } = setup();
  assert.equal(await canReadLibraryPath(client, { id: authId, email: 'member@example.invalid' }, alias, house + '/private.pdf'), true);
  assert.equal(await canReadLibraryPath(client, { id: siblingAuth, email: 'sibling@example.invalid' }, house, house + '/private.pdf'), false);
  assert.equal(await canReadLibraryPath(client, { id: otherAuth, email: 'outside@example.invalid' }, house, house + '/shared.pdf'), false);
  assert.equal(await canReadLibraryPath(client, { id: authId, email: 'member@example.invalid' }, house, house + '/not-registered.pdf'), false);
  assert.equal(await canReadLibraryPath(client, { id: house, email: 'owner@example.invalid' }, house, house + '/private.pdf'), true);
});
test('publicação rejeita destinatário de outra casa e IDs inexistentes antes de salvar', async () => {
  const { client } = setup();
  assert.deepEqual((await validateLibraryRecipients(client, alias, { visibilidade: 'individual', destinatarios: [member, member] })).destinatarios, [member]);
  await assert.rejects(validateLibraryRecipients(client, house, { visibilidade: 'individual', destinatarios: [other] }), /não pertence/);
  await assert.rejects(validateLibraryRecipients(client, house, { visibilidade: 'individual', destinatarios: [authId] }), /não está cadastrado/);
});
test('PDF legado com arquivo_url e storage_path nulo usa o proxy com a autorização atual',async()=>{
  const {client,tables}=setup();
  tables.biblioteca.push({id:'legacy',tenant_id:alias,arquivo_url:'https://storage.invalid/storage/v1/object/sign/biblioteca_estudos/'+house+'/legado.pdf?token=old',storage_path:null,visibilidade:'casa'});
  assert.equal(await canReadLibraryPath(client,{id:authId,email:'member@example.invalid'},house,house+'/legado.pdf'),true);
  assert.equal(await canReadLibraryPath(client,{id:otherAuth,email:'outside@example.invalid'},house,house+'/legado.pdf'),false);
});
