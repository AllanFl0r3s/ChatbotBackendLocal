// Solo SQL local académico. Crea una cuenta desechable y limpia exclusivamente sus filas.
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true, quiet: true });
for (const host of [process.env.DB_HOST, process.env.PROD_DB_HOST || process.env.DB_HOST2 || process.env.DB_HOST]) {
  if (!['127.0.0.1', 'localhost'].includes(host)) throw Error('Prueba limitada a SQL local.');
}
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { DataSource } = require('typeorm');
const { AppModule } = require('../dist/app.module');
let app, adminToken, userToken, userId;
const username = 'route.test.' + randomUUID().slice(0, 8);
const password = randomUUID() + '!';
let passed = 0;
(async () => {
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function api(method, endpoint, body, token) {
      const response = await fetch(base + endpoint, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
      });
      return { status: response.status, data: response.status === 204 ? null : await response.json() };
    }
    async function check(label, run) { await run(); passed++; console.log('PASS ' + label); }
    adminToken = (await api('POST', '/auth/login', { identifier: 'admin.local', password: 'DemoLocal2026!' })).data.accessToken;
    assert.ok(adminToken);
    await check('administrador crea una cuenta con ruta S08 y la lectura conserva la asignación', async () => {
      const created = await api('POST', '/users', { nombre: 'Prueba desechable de rutas', usuario: username,
        email: username + '@example.invalid', password, roleId: 2, rutaCodigo: 'S08' }, adminToken);
      assert.equal(created.status, 201); userId = created.data.id;
      assert.deepEqual(created.data.rutasAsignadas, ['S08']);
      const read = await api('GET', '/users/' + userId, undefined, adminToken);
      assert.equal(read.data.rutaCodigo, 'S08');
    });
    userToken = (await api('POST', '/auth/login', { identifier: username, password })).data.accessToken;
    assert.ok(userToken);
    await check('el usuario no puede cambiar su propia ruta', async () => {
      assert.equal((await api('PATCH', '/users/' + userId, { rutaCodigo: 'S01' }, userToken)).status, 403);
    });
    await check('ruta autorizada permite visitas y ruta ajena se deniega', async () => {
      const visits = await api('GET', '/visits/clients?route=S08&date=2026-11-05', undefined, userToken);
      assert.equal(visits.status, 200); assert.ok(visits.data.totalClients > 0);
      assert.equal((await api('GET', '/visits/clients?route=S09&date=2026-11-05', undefined, userToken)).status, 403);
    });
    await check('el chatbot usa la ruta guardada para historial', async () => {
      await api('POST', '/chat/message', { message: 'menu' }, userToken);
      const reply = await api('POST', '/chat/message', { message: '¿Cuándo fue la última compra del cliente DEMO001?' }, userToken);
      assert.equal(reply.status, 201); assert.match(reply.data.reply, /Registro: DEMO-VENTA-/);
    });
    await check('la reasignación a S09 cambia permisos sin volver a iniciar sesión', async () => {
      const updated = await api('PATCH', '/users/' + userId, { rutaCodigo: 'S09' }, adminToken);
      assert.equal(updated.status, 200); assert.equal(updated.data.rutaCodigo, 'S09');
      assert.equal((await api('GET', '/visits/clients?route=S08&date=2026-11-05', undefined, userToken)).status, 403);
      assert.equal((await api('GET', '/visits/clients?route=S09&date=2026-11-05', undefined, userToken)).status, 200);
      const reply = await api('POST', '/chat/message', { message: 'más' }, userToken);
      assert.match(reply.data.reply, /No tienes permiso/);
    });
    await check('el servidor rechaza S11 y conserva la ruta anterior', async () => {
      assert.equal((await api('PATCH', '/users/' + userId, { rutaCodigo: 'S11' }, adminToken)).status, 400);
      assert.equal((await api('GET', '/users/' + userId, undefined, adminToken)).data.rutaCodigo, 'S09');
    });
    await check('quitar la ruta revoca acceso a visitas e historial', async () => {
      const updated = await api('PATCH', '/users/' + userId, { rutaCodigo: null }, adminToken);
      assert.equal(updated.status, 200); assert.deepEqual(updated.data.rutasAsignadas, []);
      assert.equal((await api('GET', '/visits/clients?route=S09&date=2026-11-05', undefined, userToken)).status, 403);
      await api('POST', '/chat/message', { message: 'menu' }, userToken);
      const reply = await api('POST', '/chat/message', { message: '10' }, userToken);
      assert.match(reply.data.reply, /No tienes permiso/);
    });
    await api('POST', '/auth/logout', {}, userToken);
    await api('POST', '/auth/logout', {}, adminToken);
    console.log(JSON.stringify({ passed, source: 'SQL local académico', inventoryChanges: 0 }));
  } catch (error) { console.error('FAIL: ' + error.message); process.exitCode = 1; }
  finally {
    if (app && userId) {
      // No borrar cuentas preexistentes: se comprueban ID y nombre único de esta ejecución.
      await app.get(DataSource).transaction(async manager => {
        const found = await manager.query('SELECT ID_USUARIO FROM dbo.TBL_USUARIOS WHERE ID_USUARIO=@0 AND Usuario=@1', [userId, username]);
        if (found.length !== 1) throw Error('No se identificó la cuenta desechable para limpieza.');
        await manager.query('DELETE FROM dbo.TBL_MENSAJES WHERE Id_Usuario=@0 OR Id_Sesion IN (SELECT ID_SESION FROM dbo.TBL_SESIONES WHERE Id_Usuario=@0)', [userId]);
        await manager.query('DELETE FROM dbo.TBL_SESIONES WHERE Id_Usuario=@0', [userId]);
        await manager.query('DELETE FROM dbo.TBL_USUARIOS WHERE ID_USUARIO=@0 AND Usuario=@1', [userId, username]);
      });
      console.log('Limpieza: cuenta y conversaciones desechables retiradas.');
    }
    await app?.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
