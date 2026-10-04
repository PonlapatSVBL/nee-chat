import { and, desc, eq } from 'drizzle-orm';
import type { Payment } from '@/domain/payment/payment';
import type { PaymentRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { payments } from '@/infrastructure/db/schema';
import { paymentToRow, rowToPayment } from './mappers';

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string, userId: string): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.userId, userId)))
      .limit(1);
    return rows[0] ? rowToPayment(rows[0]) : null;
  }

  async listByLoan(loanId: string, userId: string): Promise<Payment[]> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.loanId, loanId), eq(payments.userId, userId)));
    return rows.map(rowToPayment);
  }

  async findLatestActive(loanId: string, userId: string): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.loanId, loanId), eq(payments.userId, userId), eq(payments.status, 'ACTIVE')))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt))
      .limit(1);
    return rows[0] ? rowToPayment(rows[0]) : null;
  }

  async insert(payment: Payment): Promise<void> {
    await this.db.insert(payments).values(paymentToRow(payment));
  }

  /** ACTIVE → VOIDED once. Throws if the row is missing or already voided, rolling back the unit of work. */
  async markVoided(payment: Payment): Promise<void> {
    const rows = await this.db
      .update(payments)
      .set({
        status: payment.status,
        voidedAt: payment.voidedAt,
        voidReason: payment.voidReason,
        replacedByPaymentId: payment.replacedByPaymentId,
      })
      .where(and(eq(payments.id, payment.id), eq(payments.userId, payment.userId), eq(payments.status, 'ACTIVE')))
      .returning({ id: payments.id });
    if (rows.length === 0) throw new Error('payment already voided or missing');
  }
}
