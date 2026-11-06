import { AuthSessionsService } from './auth-sessions.service';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RegisterPayloadGuard } from './guards/register-payload.guard';
import { AdminGuard } from './guards/admin.guard';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';

// Contraseñas exclusivamente de pruebas; no se crea ninguna cuenta SQL ni se envía correo.
describe('Registro público: validación, rol fijo y login posterior', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const role = { id: 2, nombre: 'USUARIO', estado: true };
  const body = { nombre: '  Persona ficticia  ', usuario: '  Persona.Demo  ',
    email: '  PERSONA@example.invalid  ', password: 'UnaClaveDePrueba-2026!' };
  const lookup = { where: jest.fn().mockReturnThis(), orWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(), getOne: jest.fn() };
  const users = { findOne: jest.fn(() => lookup.getOne()), createQueryBuilder: jest.fn(), create: jest.fn(), save: jest.fn() };
  const roles = { findOne: jest.fn() };
  const adminServices = { findAll: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const secret = 'registration-tests-only-not-a-real-secret';
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret, signOptions: { expiresIn: 3600 } })],
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AuthSessionsService, useValue: { open: jest.fn().mockResolvedValue(undefined),
          assertActive: jest.fn().mockResolvedValue(undefined), revoke: jest.fn().mockResolvedValue(undefined) } },AuthService, JwtStrategy, AdminGuard, RegisterPayloadGuard,
        { provide: PasswordRecoveryService, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: UsersService, useValue: adminServices },
      ],
    }).compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    // Mismas opciones globales de la aplicación, para probar que la guarda ve
    // campos privilegiados antes de que whitelist los retire.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    lookup.getOne.mockReset().mockResolvedValue(null);
    users.createQueryBuilder.mockReturnValue(lookup);
    users.create.mockImplementation(value => ({ ...value }));
    users.save.mockReset().mockImplementation(async value => ({ ...value, id: 9 }));
    roles.findOne.mockReset().mockResolvedValue({ ...role });
  });
  afterAll(async () => { await app?.close(); });

  it('normaliza identificadores, usa rol 2 y guarda bcrypt sin devolver secretos ni JWT', async () => {
    const result = await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    const saved = users.save.mock.calls[0][0];
    expect(saved).toMatchObject({ nombre: 'Persona ficticia', usuario: 'persona.demo',
      email: 'persona@example.invalid', roleId: 2, estado: true });
    expect(saved.passwordHash).not.toBe(body.password);
    expect(await bcrypt.compare(body.password, saved.passwordHash)).toBe(true);
    expect(result.body).toEqual({ message: 'Cuenta creada. Ya puedes iniciar sesión.' });
  });

  it('la cuenta registrada puede iniciar sesión, pero no administrar usuarios', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    lookup.getOne.mockResolvedValue({ ...users.save.mock.calls[0][0], id: 9 });
    const login = await request(app.getHttpServer()).post('/auth/login')
      .send({ identifier: 'PERSONA.DEMO', password: body.password }).expect(201);
    expect(login.body.user.roleId).toBe(2);
    expect(login.body.user).not.toHaveProperty('passwordHash');
    expect(jwt.verify(login.body.accessToken).roleId).toBe(2);
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
    expect(adminServices.findAll).not.toHaveBeenCalled();
  });

  it.each([{ roleId: 1 }, { estado: false }, { passwordHash: 'hash-elegido-por-el-cliente' },
    { role: { id: 1 } }, { id: 1 }])('rechaza campos controlados por el servidor: %j', async extra => {
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, ...extra }).expect(400);
    expect(users.save).not.toHaveBeenCalled();
    expect(roles.findOne).not.toHaveBeenCalled();
  });

  it.each([
    { password: 'corta' }, { usuario: 'nombre@correo.com' }, { email: 'sin-correo' },
    { nombre: '   ' }, { password: '😀'.repeat(24) },
  ])('rechaza datos inválidos o contraseña que bcrypt truncaría: %j', async invalid => {
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, ...invalid }).expect(400);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('rechaza un identificador existente sin guardar otra cuenta', async () => {
    lookup.getOne.mockResolvedValue({ id: 7 });
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(409);
    expect(users.save).not.toHaveBeenCalled();
  });

  it.each([2601, 2627])('convierte UNIQUE de SQL Server %s en conflicto sin detalles internos', async number => {
    users.save.mockRejectedValueOnce({ driverError: { number }, message: 'provider-private-details' });
    const result = await request(app.getHttpServer()).post('/auth/register').send(body).expect(409);
    expect(JSON.stringify(result.body)).not.toContain('provider-private-details');
  });

  it.each([null, { ...role, estado: false }, { ...role, nombre: 'ADMINISTRADOR' }])
  ('no crea cuentas cuando el rol 2 falta, está inactivo o no es USUARIO', async configuredRole => {
    roles.findOne.mockResolvedValue(configuredRole);
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(503);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('no expone errores de persistencia al cliente', async () => {
    users.save.mockRejectedValueOnce(new Error('SQL-private-host-details'));
    const result = await request(app.getHttpServer()).post('/auth/register').send(body).expect(503);
    expect(JSON.stringify(result.body)).not.toContain('SQL-private-host-details');
  });

  it('rechaza un cuerpo que no sea un objeto', async () => {
    await request(app.getHttpServer()).post('/auth/register').send([]).expect(400);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('no emite un nuevo JWT al iniciar sesión con rol inactivo', async () => {
    lookup.getOne.mockResolvedValue({ id: 9, estado: true, role: { ...role, estado: false }, passwordHash: 'no-se-compara' });
    await request(app.getHttpServer()).post('/auth/login')
      .send({ identifier: 'persona.demo', password: body.password }).expect(403);
  });

  it('conserva el login y acceso administrativo de la cuenta administradora activa', async () => {
    lookup.getOne.mockResolvedValue({ id: 1, roleId: 1, estado: true,
      role: { id: 1, nombre: 'ADMINISTRADOR', estado: true },
      passwordHash: await bcrypt.hash(body.password, 4) });
    const login = await request(app.getHttpServer()).post('/auth/login')
      .send({ identifier: 'admin.prueba', password: body.password }).expect(201);
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
  });
});
