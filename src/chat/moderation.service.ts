import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class ModerationService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async isAllowedText(text: string): Promise<boolean> {
    const r = await this.client.moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    });

    // Bloquea si cualquier resultado es flagged
    return !r.results?.some((x: any) => x.flagged);
  }
}
