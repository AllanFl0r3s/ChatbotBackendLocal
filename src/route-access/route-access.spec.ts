import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { RouteAccessService } from './route-access.service';

describe('Asignaciones de rutas guardadas por administración', () => {
  let user: any;
  let access: RouteAccessService;
  let findOne: jest.Mock;
  beforeEach(() => {
    user = { id: 12, estado: true, rutaGestionada: false, rutaCodigo: null };
    findOne = jest.fn(async () => user);
    access = new RouteAccessService({ findOne } as any,
      new ConfigService({ VISITS_ROUTE_ACCESS: '{"12":["S08","S09"]}' }));
  });
  it('conserva los accesos anteriores hasta guardar una nueva asignación', async () => {
    await expect(access.resolve(12)).resolves.toBe('S08');
    await expect(access.resolve(12, 'S09')).resolves.toBe('S09');
  });
  it('reconsulta la asignación, revoca las rutas anteriores y no confía en una ruta enviada por el cliente', async () => {
    await expect(access.resolve(12, 'S08')).resolves.toBe('S08');
    user = { ...user, rutaGestionada: true, rutaCodigo: 'S01' };
    await expect(access.resolve(12)).resolves.toBe('S01');
    await expect(access.resolve(12, 'S08')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access.resolve(12, 'S02')).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).toHaveBeenLastCalledWith({ where: { id: 12 } });
  });
  it('sin ruta explícita no recupera los permisos de configuración anteriores', async () => {
    user.rutaGestionada = true;
    await expect(access.resolve(12, 'S08')).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.routesFor(user)).toEqual([]);
  });
  it('no permite consultas de cuentas desactivadas o inexistentes', async () => {
    user.estado = false;
    await expect(access.resolve(12)).rejects.toBeInstanceOf(ForbiddenException);
    user = null;
    await expect(access.resolve(12)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('un fallo SQL no permite consultar datos con permisos antiguos', async () => {
    findOne.mockRejectedValueOnce(new Error('private SQL details'));
    await expect(access.resolve(12)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
