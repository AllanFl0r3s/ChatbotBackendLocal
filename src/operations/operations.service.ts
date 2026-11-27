import { Injectable } from '@nestjs/common';
import { RouteAccessService } from '../route-access/route-access.service';
import { OperationsRepository } from './operations.repository';
import { normalize, shortDate, todayInHonduras } from '../suggestions/suggestions.core';

export type OperationsContext = { active: true; module: 'wallet'|'route'; route: string; action?: number; date?: string; client?: string; page?: number };
const WALLET_MENU = 'Cartera y vencimientos\n1) Resumen de saldos de mi ruta\n2) Documentos vencidos\n3) Documentos por código de cliente\n4) Vencimientos de hoy a 7 días\n5) Volver al menú principal';
const ROUTE_MENU = 'Ruta y visitas\n1) Clientes de mi ruta\n2) Clientes con registros de visita por fecha\n3) Clientes sin registros de visita por fecha\n4) Datos de mi ruta\n5) Volver al menú principal';
export const validVisitDate = (value: string, today: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > today) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
};
const money = (value: unknown) => `L ${Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

@Injectable()
export class OperationsService {
  constructor(private readonly access: RouteAccessService, private readonly repo: OperationsRepository) {}
  async handle(userId: number, text: string, previous?: OperationsContext): Promise<{ reply: string; context: OperationsContext|null; exit?: boolean }|null> {
    const t = normalize(text);
    const entry = /^(7|opcion 7|cartera(?: y vencimientos)?)$/.test(t) ? 'wallet'
      : /^(8|opcion 8|ruta y visitas)$/.test(t) ? 'route' : undefined;
    if (!previous?.active && !entry) return null;
    if (/^(menu|menu principal|volver al menu principal|salir)$/.test(t) || (previous?.active && t==='5'))
      return { reply:'',context:null,exit:true };
    let route: string;
    try { route = await this.access.resolve(userId,previous?.route); }
    catch(error) { return {reply:(error as Error).message,context:null}; }
    const module = previous?.module ?? entry!;
    const ctx: OperationsContext = previous ? {...previous} : {active:true,module,route};
    const menu = module==='wallet' ? WALLET_MENU : ROUTE_MENU;
    const today = todayInHonduras();
    const territory = await this.repo.territory(route);
    if (!territory) return {reply:'Tu ruta todavía no tiene un sector de Cortés configurado. Solicita la revisión del administrador.',context:null};
    const heading = `Ruta ${route} · ${territory.Municipio}, ${territory.Departamento} · Zona ${territory.Zona}`;
    const footer = `\n\nDatos ficticios de demostración · Consulta: ${shortDate(today)}.\nEscribe “atrás” para volver.`;
    if (!previous || t==='atras') {
      if (previous && !previous.action && t==='atras') return {reply:'',context:null,exit:true};
      return {reply:`${heading}\n\n${menu}${footer}`,context:{active:true,module,route}};
    }
    const next = /^(mas|siguientes)$/.test(t);
    if (next && ((module==='wallet' && ctx.action===3 && !ctx.client) || (module==='route' && [2,3].includes(ctx.action??0) && !ctx.date)))
      return {reply:module==='wallet'?'Primero escribe el código del cliente.':'Primero escribe la fecha como AAAA-MM-DD o “hoy”.',context:ctx};
    if (!next && !((ctx.action===3 && module==='wallet' && !ctx.client) || (module==='route' && [2,3].includes(ctx.action??0) && !ctx.date))) {
      if (!/^[1-4]$/.test(t)) return {reply:`Elige una opción del 1 al 5.\n\n${menu}${footer}`,context:ctx};
      ctx.action=Number(t); ctx.page=0; delete ctx.date; delete ctx.client;
    } else if (next) {
      if (!ctx.action || (module==='wallet' && ctx.action===1) || (module==='route' && ctx.action===4))
        return {reply:`Elige una consulta antes de pedir más resultados.\n\n${menu}`,context:ctx};
      ctx.page=(ctx.page??0)+1;
    }
    if (module==='wallet' && ctx.action===3 && !ctx.client) {
      if (/^[1-4]$/.test(t)) return {reply:`Escribe el código del cliente, por ejemplo CORT-${route}-01. Solo se consultan clientes de tu ruta.`,context:ctx};
      if (!/^[a-z0-9-]{3,20}$/i.test(text.trim())) return {reply:'Escribe un código válido de cliente, sin espacios.',context:ctx};
      ctx.client=text.trim().toUpperCase();
    }
    if (module==='route' && [2,3].includes(ctx.action??0) && !ctx.date) {
      if (/^[1-4]$/.test(t)) return {reply:'Escribe la fecha como AAAA-MM-DD, por ejemplo 2026-11-27. También puedes escribir “hoy”.',context:ctx};
      const date = t==='hoy' ? today : text.trim();
      if (!validVisitDate(date,today)) return {reply:'La fecha no es válida o es futura. Usa AAAA-MM-DD o escribe “hoy”.',context:ctx};
      ctx.date=date;
    }
    if (module==='wallet' && ctx.action===1) {
      const totals=await this.repo.summary(route,today);
      return {reply:`${heading}\n\nDocumentos con saldo: ${totals.Documentos}\nSaldo pendiente: ${money(totals.Saldo)}\nSaldo vencido: ${money(totals.Vencido)}\nVence de hoy a 7 días: ${money(totals.Proximos)}\n\n${menu}${footer}`,context:ctx};
    }
    if (module==='route' && ctx.action===4) return {reply:`${heading}\nSector de demostración en Cortés. La asignación de cuentas se administra en Usuarios.\n\n${menu}${footer}`,context:ctx};
    const rows = module==='wallet' ? await this.repo.wallet(route,today,ctx.page??0,ctx.action!,ctx.client)
      : await this.repo.clients(route,ctx.date??today,ctx.page??0,ctx.action===2?'visited':ctx.action===3?'unvisited':'all');
    if (!rows.length) return {reply:`${heading}\n\n${ctx.page ? 'No hay más resultados.' : module==='wallet' ? 'No hay documentos con saldo que coincidan para los clientes autorizados de tu ruta.' : 'No hay clientes que coincidan con esta consulta.'}${footer}`,context:ctx};
    const list=rows.map((r:any)=>module==='wallet'
      ? `${r.Numero} · ${r.Codigo} — ${r.Nombre}\nSaldo: ${money(r.Saldo)} · Vence: ${shortDate(r.Vencimiento)} · ${r.Vencido?'Vencido':'No vencido'}`
      : `${r.Codigo} — ${r.Nombre}${ctx.date ? `\nRegistros de visita: ${r.Registros}` : ''}`).join('\n\n');
    const total=Number(rows[0].Total), start=(ctx.page??0)*5+1;
    return {reply:`${heading}${ctx.date?`\nFecha de visita en Honduras: ${shortDate(ctx.date)}`:''}\n\nMostrando ${start} a ${start+rows.length-1} de ${total}\n\n${list}`+
      (start+rows.length<=total?'\nEscribe “más” para continuar.':'')+
      (module==='route'&&ctx.date?'\nUn registro no acredita venta ni visita completada.':'')+footer,context:ctx};
  }
}
