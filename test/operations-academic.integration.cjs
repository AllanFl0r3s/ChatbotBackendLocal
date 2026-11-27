// Solo SQL local académico. La cuenta de prueba y sus conversaciones se retiran al terminar.
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
require('dotenv').config({path:path.join(__dirname,'../.env'),override:true,quiet:true});
for(const host of [process.env.DB_HOST,process.env.PROD_DB_HOST||process.env.DB_HOST2||process.env.DB_HOST])
  if(!['127.0.0.1','localhost'].includes(host))throw Error('Solo SQL local académico.');
require('reflect-metadata');
const {NestFactory}=require('@nestjs/core');
const {ValidationPipe}=require('@nestjs/common');
const {DataSource}=require('typeorm');
const {AppModule}=require('../dist/app.module');
const {SuggestionsRepository}=require('../dist/suggestions/suggestions.repository');
let app,userId,adminToken,userToken,passed=0;
const username='ops.test.'+randomUUID().slice(0,8),password=randomUUID()+'!';
(async()=>{
 try{
  app=await NestFactory.create(AppModule,{logger:false});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  async function api(method,url,body,token){const response=await fetch(base+url,{method,
   headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
   return {status:response.status,data:response.status===204?null:await response.json()};}
  adminToken=(await api('POST','/auth/login',{identifier:'admin.local',password:'DemoLocal2026!'})).data.accessToken;
  assert.ok(adminToken);
  const created=await api('POST','/users',{nombre:'Prueba de cartera y ruta',usuario:username,email:username+'@example.invalid',password,roleId:2,rutaCodigo:'S01'},adminToken);
  assert.equal(created.status,201);userId=created.data.id;
  userToken=(await api('POST','/auth/login',{identifier:username,password})).data.accessToken;assert.ok(userToken);
  async function chat(message){const r=await api('POST','/chat/message',{message},userToken);assert.equal(r.status,201);return r.data.reply;}
  const cases=[
   ['menú sin pendientes',['menu'],/8\) Ruta y visitas · Cortés, zona norte/],
   ['ruta y sector de Cortés',['8'],/San Pedro Sula, Cortés · Zona NORTE/],
   ['clientes de mi ruta',['8','1'],/CLI-001[\s\S]*CLI-002/],
   ['visitas por fecha y cliente distinto',['8','2','2026-11-27'],/Mostrando 1 a 1 de 1[\s\S]*Registros de visita: 2/],
   ['clientes sin registro',['8','3','2026-11-27'],/CLI-002/],
   ['fecha imposible',['8','2','2026-02-30'],/fecha no es válida/],
   ['fecha futura',['8','2','2099-01-01'],/fecha no es válida/],
   ['atrás vuelve al submenú',['8','2','atrás'],/1\) Clientes de mi ruta/],
   ['paginación de clientes agotada',['8','1','más'],/No hay más resultados/],
   ['resumen de cartera',['7','1'],/Saldo pendiente: L 3,200\.00/],
   ['ayuda con pulperías de la base',['7','3'],/CLI-001 — Pulpería La Bendición[\s\S]*CLI-005/],
   ['documentos vencidos',['7','2'],/FAC-DEMO-CORT-S01-01[\s\S]*L 800\.00/],
   ['cartera por cliente',['7','3','CLI-001'],/L 800\.00/],
   ['pulpería pagada sin documentos pendientes',['7','3','CLI-005'],/No hay documentos con saldo/],
   ['cliente de otra ruta sin exposición de saldos',['7','3','CLI-006'],/No hay documentos con saldo/],
   ['vencimientos próximos',['7','4'],/FAC-DEMO-CORT-S01-02/],
   ['cliente con caracteres SQL rechazado',['7','3',"CLI-001' OR 1=1"],/código válido/],
   ['promoción general navideña',['6'],/Promo navideña DEMO 6\+1/],
   ['bonificación estructurada',['9','CLI-001','4'],/Compra 6 botellas y recibe 1 botella/],
   ['salir de cartera',['7','5'],/10\) Historial/],
   ['salir de ruta',['8','5'],/10\) Historial/],
  ];
  for(const [label,messages,pattern]of cases){await chat('menu');let reply;
   for(const message of messages)reply=await chat(message);assert.match(reply,pattern,label);passed++;console.log('PASS '+label);}
  await chat('menu');await chat('7');
  assert.equal((await api('PATCH','/users/'+userId,{rutaCodigo:'S02'},adminToken)).status,200);
  assert.match(await chat('1'),/No tienes permiso/);passed++;console.log('PASS reasignación durante cartera');
  await chat('menu');await chat('8');
  assert.equal((await api('PATCH','/users/'+userId,{rutaCodigo:null},adminToken)).status,200);
  assert.match(await chat('1'),/No tienes permiso/);passed++;console.log('PASS revocación durante ruta');
  for(let number=1;number<=10;number++){
   const route='S'+String(number).padStart(2,'0');
   assert.equal((await api('PATCH','/users/'+userId,{rutaCodigo:route},adminToken)).status,200);
   await chat('menu');await chat('8');const clients=await chat('1');
   assert.match(clients,/Mostrando 1 a 5 de 5/);
   for(let position=1;position<=5;position++)assert.ok(clients.includes('CLI-'+String((number-1)*5+position).padStart(3,'0')));
   await chat('menu');await chat('7');assert.match(await chat('1'),/Saldo pendiente: L 3,200\.00/);
   passed++;console.log('PASS cinco pulperías y cartera autorizada '+route);
  }
  const repo=app.get(SuggestionsRepository);
  const start=await repo.catalog('2026-11-27'),end=await repo.catalog('2026-12-31'),expired=await repo.catalog('2027-01-01');
  assert.equal(start.promotions.find(p=>p.sku==='PT990000001').buyQuantity,6);
  assert.equal(end.promotions.find(p=>p.sku==='PT990000001').bonusQuantity,1);
  assert.ok(!expired.promotions.some(p=>p.sku==='PT990000001'));passed++;console.log('PASS vigencia SQL inclusiva y caducidad');
  await api('POST','/auth/logout',{},userToken);await api('POST','/auth/logout',{},adminToken);
  console.log(JSON.stringify({passed,source:'SQL local académico',salesOrInventoryWrites:0}));
 }catch(error){console.error('FAIL '+error.message);process.exitCode=1;}
 finally{
  if(app&&userId)await app.get(DataSource).transaction(async manager=>{
   const found=await manager.query('SELECT ID_USUARIO FROM dbo.TBL_USUARIOS WHERE ID_USUARIO=@0 AND Usuario=@1',[userId,username]);
   if(found.length!==1)throw Error('Cuenta desechable no identificada para limpieza.');
   await manager.query('DELETE FROM dbo.TBL_MENSAJES WHERE Id_Usuario=@0 OR Id_Sesion IN (SELECT ID_SESION FROM dbo.TBL_SESIONES WHERE Id_Usuario=@0)',[userId]);
   await manager.query('DELETE FROM dbo.TBL_SESIONES WHERE Id_Usuario=@0',[userId]);
   await manager.query('DELETE FROM dbo.TBL_USUARIOS WHERE ID_USUARIO=@0 AND Usuario=@1',[userId,username]);
  });
  await app?.close();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
