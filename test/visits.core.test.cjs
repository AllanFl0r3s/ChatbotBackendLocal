// Pruebas sin conexión empresarial ni dependencias: Node.js 22.18 o superior.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseVisitsQuery, authorizeVisitsRoute, visitsSqlParameters, buildVisitsResponse,
  VisitsInputError, VisitsAccessError, VisitsConfigurationError,
} = require('../src/visits/visits.core.ts');
const query = () => parseVisitsQuery({ route: 'S08', date: '2026-11-02' });

test('normaliza ruta y establece paginación por defecto', () => {
  assert.deepEqual(parseVisitsQuery({ route: ' s08 ', date: '2026-11-02' }), {
    route: 'S08', date: '2026-11-02', page: 1, pageSize: 50,
  });
});
test('rechaza fechas imposibles y acepta año bisiesto', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '02/11/2026', '', '0000-01-01']) {
    assert.throws(() => parseVisitsQuery({ route: 'S08', date }), VisitsInputError);
  }
  assert.equal(parseVisitsQuery({ route: 'S08', date: '2028-02-29' }).date, '2028-02-29');
});
test('rechaza parámetros ausentes, listas e intentos de inyección', () => {
  for (const route of [undefined, ['S08', 'S09'], {}, "S08'; DROP TABLE X;--", '']) {
    assert.throws(() => parseVisitsQuery({ route, date: '2026-11-02' }), VisitsInputError);
  }
  assert.throws(() => parseVisitsQuery({ route: 'S08' }), VisitsInputError);
});
test('limita paginación y rechaza ceros, decimales y arrays', () => {
  for (const pageSize of ['0', '101', '-1', '2.5', ['10'], '1e2', '']) {
    assert.throws(() => parseVisitsQuery({ route: 'S08', date: '2026-11-02', pageSize }), VisitsInputError);
  }
  assert.throws(() => parseVisitsQuery({ route: 'S08', date: '2026-11-02', page: '1000001' }), VisitsInputError);
});
test('solo permite rutas asignadas al usuario autenticado', () => {
  authorizeVisitsRoute(12, 'S08', '{"12":[" s08 "]}');
  assert.throws(() => authorizeVisitsRoute(12, 'S09', '{"12":["S08"]}'), VisitsAccessError);
  assert.throws(() => authorizeVisitsRoute(13, 'S08', '{"12":["S08"]}'), VisitsAccessError);
  assert.throws(() => authorizeVisitsRoute(12, 'S08', '{}'), VisitsAccessError);
  assert.throws(() => authorizeVisitsRoute(NaN, 'S08', '{}'), VisitsAccessError);
});
test('configuración rota o comodines nunca habilitan acceso', () => {
  for (const config of ['no-json', 'null', '[]', '{"12":"S08"}', '{"12":["*"]}']) {
    assert.throws(() => authorizeVisitsRoute(12, 'S08', config), VisitsConfigurationError);
  }
});
test('valores SQL separados y límites de página estables', () => {
  const parsed = parseVisitsQuery({ route: 'S08', date: '2026-11-02', page: '2', pageSize: '5' });
  assert.deepEqual(visitsSqlParameters(parsed), ['S08', '2026-11-02', 5, 10]);
});
test('respuesta de S08 diferencia 9 clientes de 13 registros', () => {
  const data = [
    ['DEMO001', 2], ['DEMO002', 1], ['DEMO003', 2], ['DEMO004', 1],
    ['DEMO005', 2], ['DEMO006', 1], ['DEMO007', 2], ['DEMO008', 1], ['DEMO009', 1],
  ].map(([ClientCode, VisitRecords]) => ({ TotalClients: 9, TotalVisitRecords: 13, ClientCode, VisitRecords }));
  const result = buildVisitsResponse(query(), data, '2026-11-02T20:00:00Z');
  assert.equal(result.totalClients, 9);
  assert.equal(result.totalVisitRecords, 13);
  assert.equal(result.clients.length, 9);
  assert.equal(result.clients.reduce((sum, c) => sum + c.visitRecords, 0), 13);
  assert.equal(result.clients[0].clientCode, 'DEMO001');
  assert.equal(result.pagination.hasNextPage, false);
});
test('página vacía conserva totales sin fabricar un cliente NULL', () => {
  const parsed = parseVisitsQuery({ route: 'S08', date: '2026-11-02', page: '3', pageSize: '5' });
  const result = buildVisitsResponse(parsed, [{ TotalClients: 9, TotalVisitRecords: 13, ClientCode: null, VisitRecords: null }], 'now');
  assert.deepEqual(result.clients, []);
  assert.equal(result.totalClients, 9);
  assert.equal(result.pagination.totalPages, 2);
});
test('sin registros devuelve una lista y totales vacíos', () => {
  const result = buildVisitsResponse(query(), [{ TotalClients: 0, TotalVisitRecords: 0, ClientCode: null, VisitRecords: null }], 'now');
  assert.deepEqual(result.clients, []);
  assert.equal(result.totalVisitRecords, 0);
  assert.equal(result.pagination.totalPages, 0);
});
