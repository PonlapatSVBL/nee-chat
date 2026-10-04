import { and, count, eq, inArray } from 'drizzle-orm';
import type { Evidence } from '@/domain/evidence/evidence';
import type { EvidenceRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { paymentEvidence } from '@/infrastructure/db/schema';
import { evidenceToRow, rowToEvidence } from './mappers';

export class DrizzleEvidenceRepository implements EvidenceRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string, userId: string): Promise<Evidence | null> {
    const rows = await this.db
      .select()
      .from(paymentEvidence)
      .where(and(eq(paymentEvidence.id, id), eq(paymentEvidence.userId, userId)))
      .limit(1);
    return rows[0] ? rowToEvidence(rows[0]) : null;
  }

  async listByPayment(paymentId: string, userId: string): Promise<Evidence[]> {
    const rows = await this.db
      .select()
      .from(paymentEvidence)
      .where(and(eq(paymentEvidence.paymentId, paymentId), eq(paymentEvidence.userId, userId)))
      .orderBy(paymentEvidence.createdAt);
    return rows.map(rowToEvidence);
  }

  async insertMany(items: readonly Evidence[]): Promise<void> {
    if (items.length === 0) return;
    await this.db.insert(paymentEvidence).values(items.map(evidenceToRow));
  }

  async countByPaymentIds(paymentIds: readonly string[], userId: string): Promise<Record<string, number>> {
    if (paymentIds.length === 0) return {};
    const rows = await this.db
      .select({ paymentId: paymentEvidence.paymentId, n: count() })
      .from(paymentEvidence)
      .where(and(inArray(paymentEvidence.paymentId, [...paymentIds]), eq(paymentEvidence.userId, userId)))
      .groupBy(paymentEvidence.paymentId);
    return Object.fromEntries(rows.map((r) => [r.paymentId, Number(r.n)]));
  }
}
