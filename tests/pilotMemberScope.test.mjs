import test from 'node:test';import assert from 'node:assert/strict';
import {isPilotPersonalMemberOperation as member,matchesActivePilotChild as active} from '../cloudflare/pilot-member-scope.js';
const base='https://axecloud.com.br';
test('personal member calendar and precepts do not inherit co-admin grants',()=>{
 for(const [path,method] of [
  ['/api/events?scope=calendar&tenantId=test','GET'],
  ['/api/v1/preceitos/current?tenantId=test','GET'],
  ['/api/v1/preceitos/3666b777-1066-4eb7-a0c3-f63c2e01ae90/acknowledge','POST'],
  ['/api/v1/preceitos/3666b777-1066-4eb7-a0c3-f63c2e01ae90/guidance','POST'],
  ['/api/transactions?userRole=filho','GET'],['/api/v1/financial/pix-config?tenantId=test','GET'],
  ['/api/v1/chat/conversations','GET'],['/api/v1/chat/conversations','POST'],
  ['/api/v1/library/materials','GET'],['/api/v1/store/checkout','POST']
 ])assert.equal(member(base+path,method),true,path);
});
test('manager actions never pass as personal actions',()=>{
 for(const [path,method] of [
  ['/api/events?scope=calendar','POST'],['/api/events','GET'],['/api/events?scope=all','GET'],
  ['/api/v1/preceitos','GET'],['/api/v1/preceitos/options','GET'],
  ['/api/v1/preceitos/3666b777-1066-4eb7-a0c3-f63c2e01ae90/status','PATCH'],
  ['/api/transactions?userRole=admin','GET'],['/api/transactions','POST'],
  ['/api/v1/financial/pix-config','POST'],['/api/children','GET'],
  ['/api/v1/store/products','POST'],['/api/v1/settings/save','PATCH'],
  ['/api/v1/chat/conversations/3666b777-1066-4eb7-a0c3-f63c2e01ae90/delete','POST'],
  ['/api/admin/users','GET']
 ])assert.equal(member(base+path,method),false,path);
});
test('member bypass requires active JWT-linked pilot child, not a browser role or email',()=>{
 const tenant='fad75b91-d2eb-4805-b5a3-c19e8a073bed',user='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 const child={user_id:user,tenant_id:tenant,status:'Ativo'};
 assert.equal(active(child,tenant,user),true);
 assert.equal(active({...child,user_id:'different'},tenant,user),false);
 assert.equal(active({...child,tenant_id:'different'},tenant,user),false);
 assert.equal(active({...child,status:'Inativo'},tenant,user),false);
 assert.equal(active(null,tenant,user),false);
});
