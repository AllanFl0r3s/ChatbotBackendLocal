import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { credentialVersion } from '../auth/credential-version';
import { JwtStrategy } from '../auth/jwt.strategy';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// HTTP y JWT reales; servicio de persistencia simulado para no modificar cuentas.
describe('Permisos HTTP de administración de usuarios', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let expiredToken: string;
  const secret = 'users-permissions-tests-only-not-a-production-secret';
  const services = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 9, roleId: 2 }),
    create: jest.fn().mockResolvedValue({ id: 9, roleId: 2 }),
    update: jest.fn().mockResolvedValue({ id: 9, roleId: 2 }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const createBody = { roleId: 2, nombre: 'Persona ficticia', usuario: 'prueba.permisos',
    email: 'permisos@example.invalid', password: 'SoloPrueba-2026!' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret })],
      controllers: [UsersController],
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: { findOne: async ({where}: any) => ({
          id: where.id, usuario: 'fixture', passwordHash: 'fixture-hash', estado: true,
          roleId: where.id === 1 || where.id === 13 ? 1 : 2, role: { estado: true },
        }) } }, AdminGuard,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: UsersService, useValue: services },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const jwt = module.get(JwtService);
    adminToken = jwt.sign({ purpose: 'access', credentialVersion: credentialVersion('fixture-hash', secret), sub: 1, roleId: 1 });
    userToken = jwt.sign({ purpose: 'access', credentialVersion: credentialVersion('fixture-hash', secret), sub: 2, roleId: 2 });
    expiredToken = jwt.sign({ purpose: 'access', credentialVersion: credentialVersion('fixture-hash', secret), sub: 1, roleId: 1 }, { expiresIn: -1 });
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => { await app?.close(); });

  const routes = [
    { method: 'get', path: '/users', service: 'findAll', status: 200 },
    { method: 'get', path: '/users/9', service: 'findOne', status: 200 },
    { method: 'post', path: '/users', service: 'create', status: 201 },
    { method: 'patch', path: '/users/9', service: 'update', status: 200 },
    { method: 'delete', path: '/users/9', service: 'remove', status: 204 },
  ] as const;

  for (const route of routes) {
    it(`${route.method.toUpperCase()} ${route.path}: sin sesión 401, usuario 403, administrador permitido`, async () => {
      const call = (token?: string) => {
        const req = request(app.getHttpServer())[route.method](route.path);
        if (token) req.set('Authorization', `Bearer ${token}`);
        if (route.method === 'post') req.send(createBody);
        if (route.method === 'patch') req.send({ nombre: 'Nombre de prueba' });
        return req;
      };
      await call().expect(401);
      await call(userToken).expect(403);
      for (const service of Object.values(services)) expect(service).not.toHaveBeenCalled();
      await call(adminToken).expect(route.status);
      expect(services[route.service]).toHaveBeenCalledTimes(1);
    });
  }

  it('un usuario no puede ascender su cuenta cambiando roleId en el cuerpo', async () => {
    await request(app.getHttpServer()).patch('/users/2')
      .set('Authorization', `Bearer ${userToken}`).send({ roleId: 1 }).expect(403);
    expect(services.update).not.toHaveBeenCalled();
  });
  it('un JWT vencido no permite administrar usuarios', async () => {
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${expiredToken}`).expect(401);
    expect(services.findAll).not.toHaveBeenCalled();
  });
  it('un token alterado no permite administrar usuarios', async () => {
    const [header, body, signature] = adminToken.split('.');
    const altered = `${header}.${body}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
    await request(app.getHttpServer()).get('/users')
      .set('Authorization', `Bearer ${altered}`).expect(401);
    expect(services.findAll).not.toHaveBeenCalled();
  });
});
