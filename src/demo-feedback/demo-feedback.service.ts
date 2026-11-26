import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DemoFeedbackDto } from './demo-feedback.dto';

@Injectable()
export class DemoFeedbackService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async submit(userId: number, dto: DemoFeedbackDto) {
    const params = [userId, dto.submissionId, dto.task, dto.outcome, dto.ease, dto.usefulness, dto.comment ?? ''];
    try {
      const rows = await this.db.query(`INSERT dbo.TBL_DEMO_FEEDBACK
        (UserId,SubmissionId,Task,Outcome,Ease,Usefulness,Comment)
        OUTPUT INSERTED.Id AS id VALUES(@0,@1,@2,@3,@4,@5,@6)`, params);
      return { id: rows[0].id, saved: true };
    } catch (error: any) {
      const number = error?.number ?? error?.driverError?.number ?? error?.originalError?.number;
      if (number === 2601 || number === 2627) {
        const rows = await this.db.query(`SELECT Id AS id,Task AS task,Outcome AS outcome,
          Ease AS ease,Usefulness AS usefulness,Comment AS comment FROM dbo.TBL_DEMO_FEEDBACK
          WHERE UserId=@0 AND SubmissionId=@1`, [userId, dto.submissionId]);
        const previous = rows[0];
        if (previous && previous.task === dto.task && previous.outcome === dto.outcome &&
            previous.ease === dto.ease && previous.usefulness === dto.usefulness && previous.comment === (dto.comment ?? '')) {
          return { id: previous.id, saved: true };
        }
        throw new ConflictException('Esta opinión ya fue enviada con otro contenido. Inicia una nueva opinión.');
      }
      throw new ServiceUnavailableException('No se pudo guardar tu opinión. Tus respuestas siguen en pantalla; intenta de nuevo.');
    }
  }

  async report(page: number) {
    try {
      const [items, totals, summary] = await Promise.all([
        this.db.query(`SELECT Id AS id,Task AS task,Outcome AS outcome,Ease AS ease,
          Usefulness AS usefulness,Comment AS comment,CreatedAt AS createdAt
          FROM dbo.TBL_DEMO_FEEDBACK ORDER BY Id DESC OFFSET @0 ROWS FETCH NEXT 50 ROWS ONLY`, [(page - 1) * 50]),
        this.db.query('SELECT COUNT(*) AS total FROM dbo.TBL_DEMO_FEEDBACK'),
        this.db.query(`SELECT Task AS task,COUNT(*) AS total,
          SUM(CASE WHEN Outcome='blocked' THEN 1 ELSE 0 END) AS blocked,
          AVG(CAST(Ease AS decimal(6,2))) AS ease,AVG(CAST(Usefulness AS decimal(6,2))) AS usefulness
          FROM dbo.TBL_DEMO_FEEDBACK GROUP BY Task ORDER BY Task`),
      ]);
      return { items, total: Number(totals[0].total), summary, page, pageSize: 50 };
    } catch {
      throw new ServiceUnavailableException('El registro de opiniones no está disponible. Comprueba la preparación de la demostración.');
    }
  }
}
