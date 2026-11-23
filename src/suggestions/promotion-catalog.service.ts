import { Injectable } from '@nestjs/common';
import { SuggestionsRepository } from './suggestions.repository';

@Injectable()
export class PromotionCatalogService {
  constructor(private readonly repo: SuggestionsRepository) {}
  // La universidad usa su catálogo SQL ficticio, sin archivos ni reglas del trabajo.
  load(today: string) { return this.repo.catalog(today); }
}
