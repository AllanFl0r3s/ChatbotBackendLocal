import { Controller, Get, UseGuards, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordRecoveryService } from './password-recovery.service';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { Sesion } from '../chat/entities/sesion.entity';

@Controller('session-test')
class ProtectedController {
  @Get() @UseGuards(JwtAuthGuard) get() { return { allowed: true }; }
}

// HTTP/JWT y servicio de sesiones reales; solo el almacenamiento SQL se sustituye.
describe('Sesiones persistidas por login y cierre individual', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let selectedId = 1;
  let accounts: any[];
  const password = 'ClaveSoloParaPruebas-2026!';
  const secret = 'sessions-tests-only-not-a-production-secret';
  const rows = new Map<number, any>();
  const lookup: any = { leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation((_sql, values) => {
      selectedId = values.identifier === 'admin.fixture' ? 1 : 2; return lookup;
    }), orWhere: jest.fn().mockReturnThis(), getOne: jest.fn(async () => accounts[selectedId - 1]) };
  const users = { createQueryBuilder: () => lookup, findOne: jest.fn(async ({ where }) => accounts.find(u => u.id === where.id)) };
  const matches = (row: any, criteria: any) => Object.entries(criteria).every(([key, value]) => row[key] === value);
  const sessionRows = {
    create: (value: any) => ({ ...value }),
    save: jest.fn(async value => { const row = { ...value, id: rows.size + 1 }; rows.set(row.id, row); return row; }),
    findOne: jest.fn(async ({ where }) => [...rows.values()].find(row => matches(row, where)) ?? null),
    update: jest.fn(async (where, patch) => {
      let affected = 0;
      for (const row of rows.values()) if (matches(row, where)) { Object.assign(row, patch); affected++; }
      return { affected };
    }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret, signOptions: { expiresIn: 3600 } })],
      controllers: [AuthController, ProtectedController],
      providers: [AuthService, JwtStrategy, AuthSessionsService,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(Sesion), useValue: sessionRows },
        { provide: PasswordRecoveryService, useValue: {} },
      ],
    }).compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  beforeEach(async () => {
    jest.clearAllMocks(); rows.clear();
    const passwordHash = await bcrypt.hash(password, 4);
    accounts = [1, 2].map(id => ({ id, roleId: id, nombre: 'Fixture', usuario: id === 1 ? 'admin.fixture' : 'user.fixture',
      email: `${id}@example.invalid`, estado: true, passwordHash,
      role: { estado: true, nombre: id === 1 ? 'ADMINISTRADOR' : 'USUARIO' } }));
  });
  afterAll(async () => { await app?.close(); });
  const login = (id = 1) => request(app.getHttpServer()).post('/auth/login')
    .send({ identifier: id === 1 ? 'admin.fixture' : 'user.fixture', password });
  const get = (token: string) => request(app.getHttpServer()).get('/session-test').set('Authorization', `Bearer ${token}`);
  const logout = (token: string, body: unknown = {}) => request(app.getHttpServer()).post('/auth/logout')
    .set('Authorization', `Bearer ${token}`).send(body);

  it.each([1, 2])('rol %s: salir invalida solo ese token y conserva otro login', async id => {
    const a = await login(id).expect(201), b = await login(id).expect(201);
    expect(a.body.accessToken).not.toBe(b.body.accessToken);
    await get(a.body.accessToken).expect(200);
    await logout(a.body.accessToken).expect(204).expect('');
    await get(a.body.accessToken).expect(401);
    await logout(a.body.accessToken).expect(401);
    await get(b.body.accessToken).expect(200);
  });
  it('guarda identificador y caducidad, sin JWT, contraseña ni hash', async () => {
    const result = await login().expect(201);
    const row = [...rows.values()][0];
    expect(row.canal).toBe('AUTH');
    expect(row.canalRef).toBe(jwt.verify(result.body.accessToken).sid);
    expect(JSON.parse(row.contexto)).toEqual({ version: 1,
      expiresAt: jwt.verify(result.body.accessToken).exp, revokedAt: null });
    expect(JSON.stringify(row)).not.toContain(result.body.accessToken);
    expect(JSON.stringify(row)).not.toContain(accounts[0].passwordHash);
  });
  it('ignora identidad ajena en cuerpo: solo cierra el JWT presentado', async () => {
    const other = await login(1).expect(201), own = await login(2).expect(201);
    await logout(own.body.accessToken, { userId: 1, sessionId: jwt.verify(other.body.accessToken).sid }).expect(204);
    await get(other.body.accessToken).expect(200);
    await get(own.body.accessToken).expect(401);
    expect(sessionRows.update).toHaveBeenCalledWith(expect.objectContaining({ idUsuario: 2, canal: 'AUTH' }), expect.anything());
  });
  it('sin JWT no modifica ninguna sesión', async () => {
    await request(app.getHttpServer()).post('/auth/logout').send({}).expect(401);
    expect(sessionRows.update).not.toHaveBeenCalled();
  });
  it('un JWT vencido no cierra una sesión', async () => {
    const result = await login().expect(201);
    const { exp, iat, ...claims } = jwt.verify(result.body.accessToken);
    await logout(jwt.sign(claims, { expiresIn: -1 })).expect(401);
    expect(sessionRows.update).not.toHaveBeenCalled();
  });
  it('una firma alterada no modifica sesiones', async () => {
    const result = await login().expect(201);
    await logout(result.body.accessToken.slice(0, -6) + 'abcdef').expect(401);
    expect(sessionRows.update).not.toHaveBeenCalled();
  });
  it('un token anterior sin sid se rechaza, aunque esté firmado y vigente', async () => {
    const result = await login().expect(201);
    const { sid, exp, iat, ...claims } = jwt.verify(result.body.accessToken);
    await get(jwt.sign(claims)).expect(401);
  });
  it.each(['missing', 'owner', 'conversation', 'damaged', 'expired', 'mismatched-expiry'])
    ('registro de sesión %s: deniega acceso', async mode => {
      const result = await login().expect(201);
      const row = [...rows.values()][0];
      if (mode === 'missing') rows.clear();
      if (mode === 'owner') row.idUsuario = 2;
      if (mode === 'conversation') row.canal = 'WEB';
      if (mode === 'damaged') row.contexto = '{bad-json';
      if (mode === 'expired') row.contexto = JSON.stringify({ version: 1, revokedAt: null, expiresAt: 1 });
      if (mode === 'mismatched-expiry') row.contexto = JSON.stringify({ version: 1, revokedAt: null, expiresAt: 9999999999 });
      await get(result.body.accessToken).expect(401);
    });
  it('la revocación permanece al recrear el servicio con el mismo almacenamiento', async () => {
    const result = await login().expect(201);
    await logout(result.body.accessToken).expect(204);
    const payload = jwt.verify(result.body.accessToken);
    const recreated = new AuthSessionsService(sessionRows as any);
    await expect(recreated.assertActive(payload.sub, payload.sid, payload.exp)).rejects.toThrow('Unauthorized');
  });
  it('no entrega JWT si no puede persistir el login', async () => {
    sessionRows.save.mockRejectedValueOnce(new Error('private-database-error'));
    const result = await login().expect(503);
    expect(JSON.stringify(result.body)).not.toContain('private-database-error');
    expect(result.body.accessToken).toBeUndefined();
  });
  it('falla cerrado si no puede consultar la sesión', async () => {
    const result = await login().expect(201);
    sessionRows.findOne.mockRejectedValueOnce(new Error('private-database-error'));
    const response = await get(result.body.accessToken).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('private-database-error');
  });
  it('si guardar el cierre falla, responde 503 y permite reintentar', async () => {
    const result = await login().expect(201);
    sessionRows.update.mockRejectedValueOnce(new Error('private-database-error'));
    await logout(result.body.accessToken).expect(503);
    await get(result.body.accessToken).expect(200);
    await logout(result.body.accessToken).expect(204);
    await get(result.body.accessToken).expect(401);
  });
  it('dos cierres concurrentes nunca reactivan la sesión', async () => {
    const result = await login().expect(201);
    const responses = await Promise.all([logout(result.body.accessToken), logout(result.body.accessToken)]);
    expect(responses.every(r => [204, 401].includes(r.status))).toBe(true);
    await get(result.body.accessToken).expect(401);
  });
  it('no altera contexto ni actividad de conversaciones WEB', async () => {
    const result = await login().expect(201);
    const conversation = { id: 99, canal: 'WEB', canalRef: '1', idUsuario: 1, contexto: 'conversación', ultimaActividad: 'anterior' };
    rows.set(99, { ...conversation });
    await logout(result.body.accessToken).expect(204);
    expect(rows.get(99)).toEqual(conversation);
  });
});
