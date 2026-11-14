// HTTP real contra bases académicas preparadas con migración 004. No crea cuentas.
// Solo escribe mensajes/sesión de la cuenta de prueba; no modifica operaciones comerciales.
const assert = require('node:assert/strict');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const base = new URL(process.env.CHATBOT_TEST_BASE_URL || 'http://localhost:3021');
const local = ['localhost', '127.0.0.1'].includes(base.hostname);
if (
  base.username ||
  base.password ||
  base.search ||
  base.hash ||
  base.pathname !== '/' ||
  (!local && (base.protocol !== 'https:' || base.hostname !== 'chatbotbackendlocal-1.onrender.com'))
) {
  throw Error('Destino no permitido para la prueba académica');
}
const identifier = process.env.CHATBOT_TEST_IDENTIFIER || (local ? 'admin.local' : '');
const password = process.env.CHATBOT_TEST_PASSWORD || (local ? 'DemoLocal2026!' : '');
if (!identifier || !password) throw Error('Configura privadamente la cuenta académica de prueba');
let token;
let failed = 0;
async function api(path, method = 'GET', body) {
  const response = await fetch(new URL(path, base), {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? {} : await response.json();
  return { status: response.status, data };
}
async function chat(message) {
  const result = await api('/chat/message', 'POST', { message });
  assert.equal(result.status, 201, `Mensaje ${message}: HTTP ${result.status}`);
  assert.equal(typeof result.data.reply, 'string');
  return result.data.reply;
}
const cases = [
  [
    'stock y detalle por bodega',
    ['1', local ? 'agua' : 'Quartz 600ml', '1'],
    [/Stock total: 135/, /120 Unids/, /15 Unids/],
  ],
  [
    'pedido con ceros iniciales',
    ['2', '0001001'],
    [/Detalle del pedido 0001001/, /PT990000001/, /24 UN/, /PT990000005/, /2 UN/, /26 UN/],
  ],
  ['pedido inexistente', ['2', '9999999'], [/No encontré el pedido/]],
  ['identificador de pedido inválido', ['2', 'incorrecto'], [/6 a 15 dígitos/]],
  [
    'ventas por producto noviembre',
    ['3', '1', 'PT990000001', '3', 'noviembre 2026'],
    [/Venta neta: L 502\.50/],
  ],
  [
    'ventas por producto octubre',
    ['3', '1', 'PT990000001', '3', 'octubre 2026'],
    [/Venta neta: L 143\.75/],
  ],
  ['ventas sin registros', ['3', '1', 'PT990000001', '3', 'enero 2025'], [/No encontré ventas/]],
  ['ventas por vendedor', ['3', '2', 'DEMO01', '3', 'noviembre 2026'], [/1,772\.00|1772\.00/]],
  [
    'ventas por categoría',
    ['3', '3', '1', 'Bebidas', '3', 'noviembre 2026'],
    [/Ventas por categoría/, local ? /Total vendido: L 732\.50/ : /Total vendido: L 1,231\.60/],
  ],
  ['proyección por producto', ['4', '1', 'PT990000001', 'noviembre 2026'], [/Cajas a vender: 15/]],
  [
    'proyección por vendedor',
    ['4', '2', 'DEMO01', 'PT990000001', 'noviembre 2026'],
    [/DEMO01/, /Cajas a vender: 10/],
  ],
  [
    'proyección por zona',
    ['4', '3', 'NORTE', 'PT990000001', 'noviembre 2026'],
    [/Zona: NORTE/, /Cajas a vender: 10/],
  ],
  ['proyección sin registros', ['4', '1', 'PT990000001', 'enero 2025'], [/No encontré proyección/]],
  ['clientes con notas', ['5', '1'], [/DEMO001/, /75\.00/, /DEMO002/, /40\.00/]],
  [
    'notas de un cliente',
    ['5', '2', 'DEMO001'],
    [/NC-DEMO-001/, /NC-DEMO-002/, /50\.00/, /25\.00/],
  ],
  ['cliente sin notas', ['5', '2', 'CLIENTE_INEXISTENTE'], [/No encontré notas/]],
  [
    'promociones vigentes noviembre 2026',
    ['6'],
    [/Encontré 3 promociones/, /Promo DEMO/, /sin validez comercial/],
  ],
  ['selección de promoción y stock', ['6', '1'], [/Stock/, /135/]],
  ['texto de promoción', ['6', 'mensaje 1'], [/ficticio|DEMO|demostraci[oó]n/i]],
  ['producto inexistente', ['stock de producto inexistente'], [/No encontré/]],
  ['stock por código', ['stock PT990000001'], [/Stock total: 135/]],
  ['texto no reconocido sin proveedor externo', ['necesito ayuda con un tema desconocido'], [/No logré identificar/]],
];
if (local) {
  cases.push(['búsqueda sin tilde', ['stock de jabon'], [/212/]]);
  cases.push(['búsqueda con tilde', ['stock de jabón'], [/212/]]);
}
(async () => {
  try {
    const login = await api('/auth/login', 'POST', { identifier, password });
    assert.equal(login.status, 201, 'Login');
    token = login.data.accessToken;
    assert.ok(token);
    console.log('Login: OK');
    for (const [name, messages, patterns] of cases) {
      try {
        await chat('menu');
        let reply = '';
        for (const message of messages) reply = await chat(message);
        for (const pattern of patterns) assert.match(reply, pattern);
        console.log('OK: ' + name);
      } catch (error) {
        failed++;
        console.log('FALLO: ' + name + ' — ' + error.message.slice(0, 700));
      }
    }
  } catch (error) {
    failed++;
    console.log('FALLO DE PREPARACION: ' + error.message);
  } finally {
    if (token) {
      try {
        assert.equal((await api('/auth/logout', 'POST')).status, 204);
        assert.equal((await api('/users')).status, 401);
        console.log('Logout y revocación: OK');
      } catch (error) {
        failed++;
        console.log('FALLO cierre: ' + error.message);
      }
    }
    console.log(`Recorridos de chat: ${cases.length}; fallos totales: ${failed}`);
    if (failed) process.exitCode = 1;
  }
})();
