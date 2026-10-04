import { and, eq } from 'drizzle-orm';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { CorrectionRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { paymentCorrections } from '@/infrastructure/db/schema';
import { correctionToRow, rowToCorrection } from './mappers';

export class DrizzleCorrectionRepository implements CorrectionRepository {
  constructor(private readonly db: DbExecutor) {}

  async insert(correction: PaymentCorrection): Promise<void> {
    await this.db.insert(paymentCorrections).values(correctionToRow(correction));
  }

  async findByReplacement(replacementPaymentId: string, userId: string): Promise<PaymentCorrection | null> {
    const rows = await this.db
      .select()
      .from(paymentCorrections)
      .where(and(eq(paymentCorrections.replacementPaymentId, replacementPaymentId), eq(paymentCorrections.userId, userId)))
      .limit(1);
    return rows[0] ? rowToCorrection(rows[0]) : null;
  }
}
