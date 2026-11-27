import { applicablePromotions,promotionText,rankPromotions } from './suggestions.core';
const promotion={id:'DEMO-PROMO-1',sku:'PT990000001',name:'Quartz 600 ml',startsOn:'2026-11-27',endsOn:'2026-12-31',
  clientCodes:['*'],conditions:'Promoción ficticia sujeta a stock.',buyQuantity:6,buyUnit:'botellas',bonusQuantity:1,bonusUnit:'botella'};
describe('Promoción navideña estructurada 6+1',()=>{
  it('respeta el inicio y fin inclusivos de la vigencia',()=>{
    const catalog={source:'Ficticia',updatedAt:null,promotions:[promotion]};
    expect(applicablePromotions(catalog,'CORT-S01-01','2026-11-26')).toHaveLength(0);
    expect(applicablePromotions(catalog,'CORT-S01-01','2026-11-27')).toHaveLength(1);
    expect(applicablePromotions(catalog,'CORT-S01-01','2026-12-31')).toHaveLength(1);
    expect(applicablePromotions(catalog,'CORT-S01-01','2027-01-01')).toHaveLength(0);
  });
  it('la consulta de bonificaciones muestra solo promociones con cantidades conocidas',()=>{
    const unknown={...promotion,id:'UNKNOWN',buyQuantity:undefined,bonusQuantity:undefined};
    const rows=rankPromotions([promotion,unknown],[],4);
    expect(rows.map(p=>p.id)).toEqual(['DEMO-PROMO-1']);
    expect(promotionText(rows[0])).toContain('Compra 6 botellas y recibe 1 botella.');
    expect(promotionText(rows[0])).toContain('31/12/2026');
  });
});
