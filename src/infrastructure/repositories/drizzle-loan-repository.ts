import { and, eq } from 'drizzle-orm';
import type { Loan } from '@/domain/loan/loan';
import type { LoanRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { loans } from '@/infrastructure/db/schema';
import { loanToRow, rowToLoan } from './mappers';

export class DrizzleLoanRepository implements LoanRepository {
  constructor(private readonly db: DbExecutor) {}

  async findByUserId(userId: string): Promise<Loan | null> {
    const rows = await this.db.select().from(loans).where(eq(loans.userId, userId)).limit(1);
    return rows[0] ? rowToLoan(rows[0]) : null;
  }

  async findById(id: string, userId: string): Promise<Loan | null> {
    const rows = await this.db
      .select()
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .limit(1);
    return rows[0] ? rowToLoan(rows[0]) : null;
  }

  async save(loan: Loan): Promise<void> {
    const row = loanToRow(loan);
    await this.db
      .insert(loans)
      .values(row)
      .onConflictDoUpdate({
        target: loans.id,
        set: {
          name: row.name,
          loanNumber: row.loanNumber,
          openingBalance: row.openingBalance,
          openingBalanceDate: row.openingBalanceDate,
          defaultAmount: row.defaultAmount,
          updatedAt: row.updatedAt,
        },
      });
  }
}
