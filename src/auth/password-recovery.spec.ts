import { AuthSessionsService } from './auth-sessions.service';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordRecoveryService } from './password-recovery.service';
import { RecoveryMailService } from './recovery-mail.service';
import { RecoveryRateGuard } from './guards/recovery-rate.guard';
import { credentialVersion } from './credential-version';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { AdminGuard } from './guards/admin.guard';

describe('Recuperación HTTP: enlace firmado y cambio atómico, sin correo real', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let current: any;
  let receivedToken: string;
  const secret = 'access-test-only-key-not-a-real-credential';
  const resetSecret = 'reset-test-only-key-not-a-real-credential';
  const before = 'ContrasenaAnterior-2026!';
  const after = 'ContrasenaNueva-2026!';
  const query: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(), execute: jest.fn(),
  };
  const users = { createQueryBuilder: jest.fn(() => query), findOne: jest.fn() };
  const mail = {
    configuration: jest.fn(() => ({ secret: resetSecret })),
    send: jest.fn(async (_email: string, token: string) => { receivedToken = token; }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret, signOptions: { expiresIn: 3600 } })],
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AuthSessionsService, useValue: { open: jest.fn().mockResolvedValue(undefined),
          assertActive: jest.fn().mockResolvedValue(undefined), revoke: jest.fn().mockResolvedValue(undefined) } },AuthService, JwtStrategy, PasswordRecoveryService, RecoveryRateGuard, AdminGuard,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: RecoveryMailService, useValue: mail },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: UsersService, useValue: { findAll: () => [] } },
      ],
    }).overrideGuard(RecoveryRateGuard).useValue({ canActivate: () => true }).compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  beforeEach(async () => {
    jest.clearAllMocks(); receivedToken = '';
    current = { id: 7, usuario: 'fixture', email: 'fixture@example.invalid', estado: true,
      roleId: 1, role: { estado: true, nombre: 'ADMINISTRADOR' }, passwordHash: await bcrypt.hash(before, 4) };
    users.findOne.mockImplementation(async () => current);
    query.getOne.mockImplementation(async () => current);
    query.execute.mockImplementation(async () => {
      const expected = query.andWhere.mock.calls.at(-1)?.[1].previous;
      if (expected !== current.passwordHash || !current.estado) return { affected: 0 };
      current = { ...current, ...query.set.mock.calls.at(-1)?.[0] };
      return { affected: 1 };
    });
  });
  afterAll(async () => { await app?.close(); });
  const forgot = () => request(app.getHttpServer()).post('/auth/forgot-password')
    .send({ email: 'FIXTURE@example.invalid' });
  const reset = (token = receivedToken, password = after) => request(app.getHttpServer())
    .post('/auth/reset-password').send({ token, password });
  const login = (password = before) => request(app.getHttpServer()).post('/auth/login')
    .send({ identifier: 'fixture', password });

  it('no devuelve token, normaliza correo y limita vigencia a 15 minutos', async () => {
    const response = await forgot().expect(200);
    expect(query.where).toHaveBeenCalledWith('LOWER(user.email) = :email', { email: current.email });
    expect(response.body).toEqual({ message: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toContain(receivedToken);
    const claims = jwt.verify(receivedToken, { secret: resetSecret, audience: 'password-reset' });
    expect(claims.exp - claims.iat).toBe(900);
    expect(claims.purpose).toBe('password-reset');
  });
  it.each(['missing', 'inactive', 'inactive-role'])('respuesta genérica: %s', async mode => {
    const first = await forgot().expect(200);
    mail.send.mockClear();
    if (mode === 'missing') query.getOne.mockResolvedValueOnce(null);
    if (mode === 'inactive') current.estado = false;
    if (mode === 'inactive-role') current.role.estado = false;
    const second = await forgot().expect(200);
    expect(second.body).toEqual(first.body);
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('actualiza hash y obliga login nuevo; invalida JWT antiguo y enlace usado', async () => {
    const old = await login().expect(201);
    await forgot().expect(200);
    const token = receivedToken;
    const result = await reset(token).expect(200);
    expect(Object.keys(result.body)).toEqual(['message']);
    expect(await bcrypt.compare(after, current.passwordHash)).toBe(true);
    expect(await bcrypt.compare(before, current.passwordHash)).toBe(false);
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${old.body.accessToken}`).expect(401);
    await reset(token).expect(400);
    await login(before).expect(401);
    const fresh = await login(after).expect(201);
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${fresh.body.accessToken}`).expect(200);
  });
  it('rechaza dos cambios concurrentes que partieron del mismo hash', async () => {
    await forgot().expect(200);
    const results = await Promise.all([reset(), reset()]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  });
  it('un token de acceso nunca sirve para recuperar', async () => {
    const response = await login().expect(201);
    await reset(response.body.accessToken).expect(400);
    expect(query.execute).not.toHaveBeenCalled();
  });
  it('un enlace de recuperación nunca sirve como sesión', async () => {
    await forgot().expect(200);
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${receivedToken}`).expect(401);
  });
  it.each(['expired', 'tampered', 'wrong-purpose', 'wrong-audience'])('rechaza %s', async mode => {
    const claims = { sub: current.id, purpose: mode === 'wrong-purpose' ? 'access' : 'password-reset',
      credentialVersion: credentialVersion(current.passwordHash, resetSecret) };
    let token = jwt.sign(claims, { secret: resetSecret, expiresIn: mode === 'expired' ? -1 : 900,
      audience: mode === 'wrong-audience' ? 'other' : 'password-reset' });
    if (mode === 'tampered') token = token.slice(0, -5) + 'abcde';
    await reset(token).expect(400);
    expect(query.execute).not.toHaveBeenCalled();
  });
  it.each(['deleted', 'inactive', 'inactive-role'])('rechaza cuenta %s después del envío', async mode => {
    await forgot().expect(200);
    if (mode === 'deleted') users.findOne.mockResolvedValueOnce(null);
    if (mode === 'inactive') current.estado = false;
    if (mode === 'inactive-role') current.role.estado = false;
    await reset().expect(400);
    expect(query.execute).not.toHaveBeenCalled();
  });
  it('no permite conservar la contraseña anterior', async () => {
    await forgot().expect(200);
    await reset(receivedToken, before).expect(400);
    expect(query.execute).not.toHaveBeenCalled();
  });
  it.each(['corta', '😀'.repeat(24)])('valida contraseña antes de consultar SQL', async password => {
    await forgot().expect(200);
    users.findOne.mockClear();
    await reset(receivedToken, password).expect(400);
    expect(users.findOne).not.toHaveBeenCalled();
  });
  it('un cambio de rol se refleja aunque el JWT tenga otro rol', async () => {
    const old = await login().expect(201);
    current.roleId = 2;
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${old.body.accessToken}`).expect(403);
  });
  it('una desactivación invalida el acceso ya emitido', async () => {
    const old = await login().expect(201);
    current.estado = false;
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${old.body.accessToken}`).expect(401);
  });
});

describe('Correo y límite de recuperación', () => {
  const config = { BREVO_API_KEY: 'fake-api-test-key', RECOVERY_FROM_EMAIL: 'demo@example.invalid',
    PASSWORD_RESET_SECRET: 'reset-test-key-at-least-32-characters', JWT_SECRET: 'different-secret',
    FRONTEND_URL: 'http://localhost:4200' };
  afterEach(() => jest.restoreAllMocks());
  it('sin configuración devuelve 503; no finge un envío', () => {
    expect(() => new RecoveryMailService(new ConfigService({})).configuration()).toThrow('todavía no está disponible');
  });
  it.each(['http://example.com', 'https://example.com/?x=1', 'https://user:pass@example.com'])
    ('rechaza origen inseguro o manipulable: %s', origin => {
      expect(() => new RecoveryMailService(new ConfigService({ ...config, FRONTEND_URL: origin }))
        .configuration()).toThrow();
    });
  it('API HTTPS con token en fragmento, sin peticiones reales', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    await new RecoveryMailService(new ConfigService(config)).send('fixture@example.invalid', 'fake.token.value');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    const payload = JSON.parse(options?.body as string);
    expect(payload.textContent).toContain('/reset-password#token=fake.token.value');
    expect(payload.to).toEqual([{ email: 'fixture@example.invalid' }]);
  });
  it('falla sin exponer respuestas ni secretos del proveedor', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    await expect(new RecoveryMailService(new ConfigService(config))
      .send('fixture@example.invalid', 'secret-token')).rejects.toThrow('No fue posible enviar');
  });
  it('limita 3 solicitudes por correo y permite después de 15 minutos', () => {
    const limiter = new RecoveryRateGuard();
    const context: any = { switchToHttp: () => ({ getRequest: () => ({
      body: { email: ' fixture@example.invalid ' }, socket: { remoteAddress: '127.0.0.1' },
    }) }) };
    const clock = jest.spyOn(Date, 'now').mockReturnValue(10000);
    for (let n = 0; n < 3; n++) expect(limiter.canActivate(context)).toBe(true);
    expect(() => limiter.canActivate(context)).toThrow('Demasiados intentos');
    clock.mockReturnValue(10000 + 15 * 60 * 1000);
    expect(limiter.canActivate(context)).toBe(true);
  });
});
