import { SuggestionsService } from '../suggestions/suggestions.service';
import { SuggestionsRepository } from '../suggestions/suggestions.repository';
import { PromotionCatalogService } from '../suggestions/promotion-catalog.service';
import { ClientLookupService } from '../suggestions/client-lookup.service';
import { AcademicRouteService } from '../suggestions/academic-route.service';
import { PurchaseHistoryService } from '../suggestions/purchase-history.service';
import { PurchaseHistoryRepository } from '../suggestions/purchase-history.repository';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { Sesion } from './entities/sesion.entity';
import { Mensaje } from './entities/mensaje.entity';

import { OpenAiService } from './openai.service';
import { ModerationService } from './moderation.service';
import { InventoryService } from './inventory.service';
import { SalesService } from './sales.service';
import { NotasCreditoService } from './notas-credito.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sesion,
      Mensaje,
    ]),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    OpenAiService,
    ModerationService,
    InventoryService,
    SalesService,
    NotasCreditoService,
    SuggestionsService,
    SuggestionsRepository,
    PromotionCatalogService,
    ClientLookupService,
    AcademicRouteService,
    PurchaseHistoryService,
    PurchaseHistoryRepository,
  ],
  exports: [ChatService],
})
export class ChatModule {}