// Reglas independientes de NestJS: permiten probar validación y permisos sin SQL.
export type VisitsQuery = { route: string; date: string; page: number; pageSize: number };
export class VisitsInputError extends Error {}
export class VisitsAccessError extends Error {}
export class VisitsConfigurationError extends Error {}

function cleanRoute(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/.test(value.trim())) {
    throw new VisitsInputError('route debe contener de 1 a 20 letras, números, guiones o guiones bajos.');
  }
  // Las fuentes contienen espacios en códigos como "S08   ".
  return value.trim().toUpperCase();
}

function positiveInteger(value: unknown, fallback: number, maximum: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new VisitsInputError(`${name} debe ser un entero positivo.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new VisitsInputError(`${name} no puede superar ${maximum}.`);
  }
  return parsed;
}

export function parseVisitsQuery(query: Record<string, unknown>): VisitsQuery {
  const route = cleanRoute(query.route);
  const date = query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '0001-01-01') {
    throw new VisitsInputError('date es obligatoria y debe tener formato AAAA-MM-DD.');
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  // Comprobar el calendario, no solo el patrón: 2026-02-30 no es válido.
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new VisitsInputError('date debe ser una fecha real del calendario.');
  }
  return {
    route, date,
    page: positiveInteger(query.page, 1, 1000000, 'page'),
    pageSize: positiveInteger(query.pageSize, 50, 100, 'pageSize'),
  };
}

export function authorizeVisitsRoute(userId: number, route: string, rawAccess: string): void {
  // La identidad viene del JWT validado, nunca de un userId recibido en la URL.
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new VisitsAccessError('Usuario no válido.');
  let access: Record<string, string[]>;
  try {
    const parsed: unknown = JSON.parse(rawAccess);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    access = {};
    for (const [id, routes] of Object.entries(parsed)) {
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !Array.isArray(routes)) throw new Error();
      access[id] = routes.map(cleanRoute);
    }
  } catch {
    // Una configuración inválida nunca debe abrir acceso a todas las rutas.
    throw new VisitsConfigurationError('La configuración de acceso a rutas no es válida.');
  }
  if (!access[String(userId)]?.includes(route)) {
    throw new VisitsAccessError('No tienes acceso a esa ruta. Debe existir una asignación autorizada.');
  }
}

// Una sola consulta devuelve página y totales; evita unir detalles que multipliquen filas.
// SQL Server 2016, compatibilidad 100: usar TRY_CAST y ROW_NUMBER, no TRY_CONVERT/OFFSET.
// @0..@3 son parámetros de TypeORM/mssql. Nunca interpolar los valores en el SQL.
export const VISITED_CLIENTS_SQL = `
WITH Clients AS (
  SELECT
    LTRIM(RTRIM(Cliente)) AS ClientCode,
    COUNT(*) AS VisitRecords
  FROM [paco].[APP_RV]
  WHERE LTRIM(RTRIM(Ruta)) = @0
    AND TRY_CAST(Fecha AS date) = CAST(@1 AS date)
    AND NULLIF(LTRIM(RTRIM(Cliente)), '') IS NOT NULL
  GROUP BY LTRIM(RTRIM(Cliente))
), Numbered AS (
  SELECT ClientCode, VisitRecords,
    ROW_NUMBER() OVER (ORDER BY ClientCode) AS RowNumber
  FROM Clients
), Totals AS (
  SELECT COUNT(*) AS TotalClients,
    COALESCE(SUM(VisitRecords), 0) AS TotalVisitRecords
  FROM Clients
)
SELECT t.TotalClients, t.TotalVisitRecords, n.ClientCode, n.VisitRecords
FROM Totals AS t
LEFT JOIN Numbered AS n
  ON n.RowNumber > @2 AND n.RowNumber <= @3
ORDER BY n.RowNumber;
`;

export function visitsSqlParameters(query: VisitsQuery): [string, string, number, number] {
  const offset = (query.page - 1) * query.pageSize;
  return [query.route, query.date, offset, offset + query.pageSize];
}

export type VisitsDbRow = {
  TotalClients: number; TotalVisitRecords: number;
  ClientCode: string | null; VisitRecords: number | null;
};

export function buildVisitsResponse(query: VisitsQuery, rows: VisitsDbRow[], queriedAt: string) {
  const totalClients = Number(rows[0]?.TotalClients ?? 0);
  const totalVisitRecords = Number(rows[0]?.TotalVisitRecords ?? 0);
  // LEFT JOIN produce una fila de totales con cliente NULL si la página está vacía.
  const clients = rows.filter(row => row.ClientCode !== null).map(row => ({
    clientCode: row.ClientCode!, visitRecords: Number(row.VisitRecords),
  }));
  return {
    route: query.route, date: query.date,
    totalClients, totalVisitRecords, clients,
    pagination: {
      page: query.page, pageSize: query.pageSize,
      totalPages: Math.ceil(totalClients / query.pageSize),
      hasNextPage: query.page * query.pageSize < totalClients,
    },
    // Este instante es de consulta; no conocemos la fecha de sincronización de APP_RV.
    queriedAt,
    description: 'Clientes con registros de visita. No acredita venta ni visita completada.',
  };
}
