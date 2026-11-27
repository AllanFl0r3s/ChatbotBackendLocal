import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { OperationsService, validVisitDate } from './operations.service';

describe('Cartera y rutas de Cortés',()=>{
  const resolve=jest.fn();
  const repo={territory:jest.fn(),summary:jest.fn(),clients:jest.fn(),wallet:jest.fn()};
  let service:OperationsService;
  beforeEach(()=>{
    jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-11-27T18:00:00Z'));
    resolve.mockResolvedValue('S01');
    repo.territory.mockResolvedValue({Municipio:'San Pedro Sula',Departamento:'Cortés',Zona:'NORTE'});
    service=new OperationsService({resolve} as any,repo as any);
  });
  afterEach(()=>jest.useRealTimers());
  it('no consulta datos si la cuenta no tiene ruta',async()=>{
    resolve.mockRejectedValueOnce(new ForbiddenException('No tienes permiso'));
    expect((await service.handle(1,'7'))?.reply).toContain('No tienes permiso');
    expect(repo.territory).not.toHaveBeenCalled(); expect(repo.wallet).not.toHaveBeenCalled();
  });
  it('consulta el resumen de la ruta autorizada con la fecha de Honduras',async()=>{
    const entry=await service.handle(1,'7');
    repo.summary.mockResolvedValue({Documentos:2,Saldo:1300,Vencido:800,Proximos:500});
    const result=await service.handle(1,'1',entry!.context!);
    expect(result?.reply).toContain('L 1,300.00');
    expect(result?.reply).toContain('L 800.00');
    expect(repo.summary).toHaveBeenCalledWith('S01','2026-11-27');
  });
  it.each(['2026-02-30','2026-11-28','ayer','27/11/2026'])(
    'rechaza fecha no admitida %s antes de consultar visitas',async date=>{
      const entry=await service.handle(1,'8');
      const prompt=await service.handle(1,'2',entry!.context!);
      expect((await service.handle(1,date,prompt!.context!))?.reply).toContain('fecha no es válida');
      expect(repo.clients).not.toHaveBeenCalled();
    });
  it('muestra dos registros para un cliente sin afirmar que fue una visita completada',async()=>{
    const entry=await service.handle(1,'8');
    const prompt=await service.handle(1,'2',entry!.context!);
    repo.clients.mockResolvedValue([{Codigo:'CORT-S01-01',Nombre:'Comercio ficticio',Registros:2,Total:1}]);
    const result=await service.handle(1,'2026-11-27',prompt!.context!);
    expect(result?.reply).toContain('Mostrando 1 a 1 de 1');
    expect(result?.reply).toContain('Registros de visita: 2');
    expect(result?.reply).toContain('no acredita venta ni visita completada');
  });
  it('volver y atrás conservan el significado de los submenús',async()=>{
    const entry=await service.handle(1,'8');
    const prompt=await service.handle(1,'3',entry!.context!);
    const menu=await service.handle(1,'atrás',prompt!.context!);
    expect(menu?.reply).toContain('1) Clientes');
    expect((await service.handle(1,'atrás',menu!.context!))?.exit).toBe(true);
    expect((await service.handle(1,'5',entry!.context!))?.exit).toBe(true);
  });
  it('una falla de datos se conserva como indisponibilidad y no como cartera vacía',async()=>{
    const entry=await service.handle(1,'7');
    repo.summary.mockRejectedValueOnce(new ServiceUnavailableException('No fue posible consultar'));
    await expect(service.handle(1,'1',entry!.context!)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('no conserva acceso si cambia la ruta durante una conversación',async()=>{
    const entry=await service.handle(1,'7');
    resolve.mockRejectedValueOnce(new ForbiddenException('No tienes permiso'));
    expect((await service.handle(1,'1',entry!.context!))?.context).toBeNull();
    expect(repo.summary).not.toHaveBeenCalled();
  });
  it('valida un día real y no permite fechas futuras',()=>{
    expect(validVisitDate('2026-11-27','2026-11-27')).toBe(true);
    expect(validVisitDate('2026-12-01','2026-11-27')).toBe(false);
  });
  it('pedir más antes de indicar la fecha no salta la primera página',async()=>{
    const entry=await service.handle(1,'8');
    const prompt=await service.handle(1,'2',entry!.context!);
    const pending=await service.handle(1,'más',prompt!.context!);
    expect(pending?.reply).toContain('Primero escribe la fecha');
    repo.clients.mockResolvedValue([]);
    await service.handle(1,'2026-11-27',pending!.context!);
    expect(repo.clients).toHaveBeenCalledWith('S01','2026-11-27',0,'visited');
  });
});
