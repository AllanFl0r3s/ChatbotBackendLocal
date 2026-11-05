import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { VisitsService } from './visits.service';
import { ACADEMIC_VISITED_CLIENTS_SQL, VISITED_CLIENTS_SQL } from './visits.core';

// Se prueba el servicio sin abrir puertos ni conectarse a bases empresariales.
describe('Visitas académicas: selección de fuente y permisos', () => {
  const sql = { query: jest.fn() };
  const query = { route: ' s08 ', date: '2026-11-05', pageSize: '5' };
  const createService = (source?: string) => new VisitsService(
    sql as unknown as DataSource,
    new ConfigService({ VISITS_ROUTE_ACCESS: '{"1":["S08"]}', VISITS_DATA_SOURCE: source }),
  );
  beforeEach(() => sql.query.mockReset());

  it('usa academico por defecto con parámetros y conserva el contrato', async () => {
    sql.query.mockResolvedValue([{ TotalClients: 9, TotalVisitRecords: 13, ClientCode: 'DEMO001', VisitRecords: 2 }]);
    const response = await createService().listClients(1, query);
    expect(sql.query).toHaveBeenCalledWith(ACADEMIC_VISITED_CLIENTS_SQL, ['S08','2026-11-05',0,5]);
    expect(response).toMatchObject({ route: 'S08', date: '2026-11-05', totalClients: 9,
      totalVisitRecords: 13, clients: [{clientCode: 'DEMO001',visitRecords: 2}],
      pagination: {page: 1, pageSize: 5, totalPages: 2, hasNextPage: true} });
  });
  it('mantiene la fuente anterior únicamente cuando se pide legacy en configuración', async () => {
    sql.query.mockResolvedValue([{TotalClients:0,TotalVisitRecords:0,ClientCode:null,VisitRecords:null}]);
    await createService('legacy').listClients(1, query);
    expect(sql.query).toHaveBeenCalledWith(VISITED_CLIENTS_SQL, ['S08','2026-11-05',0,5]);
  });
  it('falla sin consultar ni cambiar de fuente si la configuración es inválida', async () => {
    await expect(createService('otra-tabla').listClients(1, query)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sql.query).not.toHaveBeenCalled();
  });
  it('rechaza usuarios sin ruta asignada antes de acceder a SQL', async () => {
    await expect(createService().listClients(2, query)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(createService().listClients(1, {...query,route:'S09'})).rejects.toBeInstanceOf(ForbiddenException);
    expect(sql.query).not.toHaveBeenCalled();
  });
  it('rechaza fechas imposibles antes de acceder a SQL', async () => {
    await expect(createService().listClients(1, {...query,date:'2026-02-30'})).rejects.toBeInstanceOf(BadRequestException);
    expect(sql.query).not.toHaveBeenCalled();
  });
  it('distingue una fecha sin visitas de un error de base de datos', async () => {
    sql.query.mockResolvedValueOnce([{TotalClients:0,TotalVisitRecords:0,ClientCode:null,VisitRecords:null}]);
    expect(await createService().listClients(1, query)).toMatchObject({totalClients:0,totalVisitRecords:0,clients:[]});
    sql.query.mockRejectedValueOnce(new Error('private-server-details'));
    await expect(createService().listClients(1, query)).rejects.toThrow('No fue posible consultar las visitas.');
  });
  it('conserva totales al pedir una página fuera del resultado', async () => {
    sql.query.mockResolvedValue([{TotalClients:9,TotalVisitRecords:13,ClientCode:null,VisitRecords:null}]);
    const response = await createService().listClients(1, {...query,page:'3'});
    expect(response).toMatchObject({totalClients:9,clients:[],pagination:{page:3,totalPages:2,hasNextPage:false}});
    expect(sql.query).toHaveBeenCalledWith(ACADEMIC_VISITED_CLIENTS_SQL, ['S08','2026-11-05',10,15]);
  });
});
