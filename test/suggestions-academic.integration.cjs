// Pruebas HTTP locales con datos ficticios existentes. No cambia ventas ni inventario.
const fs=require('node:fs');const {createRequire}=require('node:module');
const root=require('node:path').resolve(__dirname,'..');const req=createRequire(root+'/package.json');
req('dotenv').config({path:root+'/.env',override:true,quiet:true});
for(const host of [process.env.DB_HOST,process.env.PROD_DB_HOST||process.env.DB_HOST2||process.env.DB_HOST])if(!['127.0.0.1','localhost'].includes(host))throw Error('Prueba limitada al SQL académico local');
req('reflect-metadata');const {NestFactory}=req('@nestjs/core');const {ValidationPipe}=req('@nestjs/common');const {AppModule}=req('./dist/app.module.js');const assert=require('node:assert/strict');
(async()=>{let app,token;let passed=0;
try{
 app=await NestFactory.create(AppModule,{logger:false});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 async function api(path,body,auth=true){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth&&token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:response.status,data:response.status===204?{}:await response.json()};}
 const unauthorized=await api('/chat/message',{message:'10'},false);assert.equal(unauthorized.status,401);passed++;
 const login=await api('/auth/login',{identifier:'admin.local',password:'DemoLocal2026!'},false);assert.ok([200,201].includes(login.status),'Login local no disponible');token=login.data.accessToken;assert.ok(token);passed++;
 async function chat(message){const r=await api('/chat/message',{message});assert.equal(r.status,201,'HTTP no esperado en consulta');return r.data.reply;}
 const cases=[
 ['menú ampliado',['menu'],/10\) Historial/],
 ['última compra',['¿Cuándo fue la última compra del cliente DEMO001?'],/Registro: DEMO-VENTA-/],
 ['productos de este mes',['¿Qué productos compró el cliente DEMO001 este mes?'],/Mostrando 1 a 5 de 6/],
 ['compras de octubre',['¿Qué productos compró el cliente DEMO001 el mes pasado?'],/10 unidades/],
 ['frecuencia',['¿Qué productos compra con mayor frecuencia el cliente DEMO001?'],/Lo que más compra/],
 ['paginación',['10','3','DEMO001','más'],/Mostrando 6 a 6 de 6/],
 ['cliente sin compras',['¿Cuándo fue la última compra del cliente DEMO002?'],/No encontré resultados/],
 ['clientes sin actividad',['¿Qué clientes de mi ruta llevan 30 días sin comprar?'],/Clientes sin compras/],
 ['otra ruta autorizada',['¿Qué clientes de mi ruta S09 llevan 30 días sin comprar?'],/Ruta S09/],
 ['ruta ajena',['¿Cuándo fue la última compra del cliente DEMO001 en ruta S02?'],/No tienes permiso/],
 ['cliente inexistente',['¿Cuándo fue la última compra del cliente NOEXISTE?'],/No encontré ese cliente/],
 ['promociones SQL',['9','DEMO001','1'],/DEMO-PROMO-/],
 ['promociones habituales',['9','DEMO001','2'],/DEMO-PROMO-/],
 ['promociones con stock',['9','DEMO001','3'],/Stock reportado/],
 ['bonificación sin datos',['9','DEMO001','4'],/no tienen cantidades/],
 ['promociones por vencer',['9','DEMO001','5','15 días'],/DEMO-PROMO-/],
 ['mensaje sin enviar',['9','DEMO001','6','1'],/Mensaje preparado/],
 ['opción 8 pendiente',['8'],/en desarrollo/],
 ['opción 7 pendiente',['7'],/pendiente/],
 ];
 for(const[name,messages,pattern]of cases){await chat('volver al menú principal');let reply;for(const message of messages)reply=await chat(message);assert.match(reply,pattern,name);passed++;console.log('PASS '+name);}
 const logout=await api('/auth/logout',{});assert.ok([200,201,204].includes(logout.status));passed++;console.log(JSON.stringify({passed,source:'SQL académico local',commercialWrites:0}));
}catch(e){console.log(JSON.stringify({failed:true,passed,message:e.message}));process.exitCode=1;}
finally{if(app)await app.close();}
})();
