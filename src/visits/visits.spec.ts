import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { credentialVersion } from '../auth/credential-version';
import { JwtStrategy } from '../auth/jwt.strategy';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { VISITED_CLIENTS_SQL } from './visits.core';

// Prueba HTTP real de NestJS/JWT, con fuente SQL simulada (no accede a la empresa).
describe('GET /visits/clients', () => {
  let app: INestApplication;
  let token: string;
  let unassignedToken: string;
  const sql = { query: jest.fn() };
  const secret = 'visits-tests-only-not-a-production-secret';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret })],
      controllers: [VisitsController],
      providers: [
        VisitsService, JwtStrategy,
        { provide: getRepositoryToken(User), useValue: { findOne: async ({where}: any) => ({
          id: where.id, usuario: 'fixture', passwordHash: 'fixture-hash', estado: true,
          roleId: where.id === 1 || where.id === 13 ? 1 : 2, role: { estado: true },
        }) } },
        { provide: ConfigService, useValue: new ConfigService({
          JWT_SECRET: secret, VISITS_ROUTE_ACCESS: '{"12":["S08"]}', VISITS_DATA_SOURCE: 'legacy',
        }) },
        { provide: getDataSourceToken('prodConnection'), useValue: sql },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    const jwt = module.get(JwtService);
    token = jwt.sign({ purpose: 'access', credentialVersion: credentialVersion('fixture-hash', secret), sub: 12, username: 'test', roleId: 2 });
    unassignedToken = jwt.sign({ purpose: 'access', credentialVersion: credentialVersion('fixture-hash', secret), sub: 13, username: 'other', roleId: 1 });
  });
  beforeEach(() => sql.query.mockReset());
  afterAll(async () => { await app?.close(); });

  it('rechaza llamadas sin JWT antes de consultar SQL', async () => {
    await request(app.getHttpServer()).get('/visits/clients?route=S08&date=2026-11-02').expect(401);
    expect(sql.query).not.toHaveBeenCalled();
  });
  it('rechaza rutas ajenas y usuarios sin asignación, incluso administradores', async () => {
    await request(app.getHttpServer()).get('/visits/clients?route=S09&date=2026-11-02')
      .set('Authorization', `Bearer ${token}`).expect(403);
    await request(app.getHttpServer()).get('/visits/clients?route=S08&date=2026-11-02')
      .set('Authorization', `Bearer ${unassignedToken}`).expect(403);
    expect(sql.query).not.toHaveBeenCalled();
  });
  it('valida calendario antes de consultar SQL', async () => {
    await request(app.getHttpServer()).get('/visits/clients?route=S08&date=2026-02-30')
      .set('Authorization', `Bearer ${token}`).expect(400);
    expect(sql.query).not.toHaveBeenCalled();
  });
  it('usa prodConnection con parámetros y diferencia clientes/registros', async () => {
    sql.query.mockResolvedValue([{ TotalClients: 9, TotalVisitRecords: 13, ClientCode: 'DEMO001', VisitRecords: 2 }]);
    const result = await request(app.getHttpServer()).get('/visits/clients?route=S08&date=2026-11-02&pageSize=1')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(sql.query).toHaveBeenCalledWith(VISITED_CLIENTS_SQL, ['S08', '2026-11-02', 0, 1]);
    expect(result.body.totalClients).toBe(9);
    expect(result.body.totalVisitRecords).toBe(13);
    expect(result.body.clients[0].clientCode).toBe('DEMO001');
    expect(result.body.pagination.hasNextPage).toBe(true);
  });
  it('no transforma fallos SQL en una lista de cero visitas', async () => {
    sql.query.mockRejectedValue(new Error('provider-private-details'));
    const result = await request(app.getHttpServer()).get('/visits/clients?route=S08&date=2026-11-02')
      .set('Authorization', `Bearer ${token}`).expect(503);
    expect(JSON.stringify(result.body)).not.toContain('provider-private-details');
  });
});
