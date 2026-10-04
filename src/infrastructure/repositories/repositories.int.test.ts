import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createLoan } from '@/domain/loan/loan';
import { createPayment, voidPayment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { createDb } from '@/infrastructure/db/client';
import { loans, paymentCorrections, paymentEvidence, payments } from '@/infrastructure/db/schema';
import { makeRepositories } from './index';
import { DrizzleUnitOfWork } from './unit-of-work';

const db = createDb();
const repos = makeRepositories(db);
const userId = randomUUID();
const otherUser = randomUUID();
const now = new Date('2026-10-04T09:00:00.000Z');

const loan = createLoan(
  { name: 'กยศ.', loanNumber: '12345', openingBalance: Money.of('195420.50'), openingBalanceDate: DateOnly.of('2026-06-30'), defaultAmount: Money.of('3000') },
  { id: randomUUID(), userId, now },
);

function pay(paidAt: string, amount: string, createdAt = now) {
  return createPayment(
    { paidAt: DateOnly.of(paidAt), amount: Money.of(amount), paymentMethod: 'MOBILE_BANKING', referenceNo: 'R', notes: null },
    { id: randomUUID(), loanId: loan.id, userId, now: createdAt },
  );
}

afterAll(async () => {
  await db.delete(paymentCorrections).where(eq(paymentCorrections.userId, userId));
  await db.delete(paymentEvidence).where(eq(paymentEvidence.userId, userId));
  await db.delete(payments).where(eq(payments.userId, userId));
  await db.delete(loans).where(eq(loans.userId, userId));
});

describe('Drizzle repositories', () => {
  it('round-trips a loan with exact money and date values', async () => {
    await repos.loans.save(loan);
    const found = await repos.loans.findByUserId(userId);
    expect(found?.openingBalance.toString()).toBe('195420.50');
    expect(found?.openingBalanceDate.iso).toBe('2026-06-30');
    expect(found?.defaultAmount?.toString()).toBe('3000.00');
    expect(found?.createdAt.toISOString()).toBe(now.toISOString());
    expect(await repos.loans.findByUserId(otherUser)).toBeNull();
    expect(await repos.loans.findById(loan.id, otherUser)).toBeNull();

    await repos.loans.save({ ...loan, name: 'แก้แล้ว' });
    expect((await repos.loans.findById(loan.id, userId))?.name).toBe('แก้แล้ว');
  });

  it('stores payments, finds latest active, and marks voided', async () => {
    const a = pay('2026-07-04', '3000');
    const b = pay('2026-08-04', '3000.50');
    await repos.payments.insert(a);
    await repos.payments.insert(b);
    expect((await repos.payments.listByLoan(loan.id, userId)).length).toBeGreaterThanOrEqual(2);
    expect((await repos.payments.findLatestActive(loan.id, userId))?.id).toBe(b.id);
    expect((await repos.payments.findById(b.id, userId))?.amount.toString()).toBe('3000.50');

    const voided = voidPayment(b, 'ผิด', now, a.id);
    if (!voided.ok) throw voided.error;
    await repos.payments.markVoided(voided.value);
    const reloaded = await repos.payments.findById(b.id, userId);
    expect(reloaded?.status).toBe('VOIDED');
    expect(reloaded?.voidReason).toBe('ผิด');
    expect(reloaded?.replacedByPaymentId).toBe(a.id);
    expect((await repos.payments.findLatestActive(loan.id, userId))?.id).toBe(a.id);
  });

  it('stores evidence and corrections', async () => {
    const p = pay('2026-09-04', '100');
    await repos.payments.insert(p);
    const e1 = randomUUID();
    await repos.evidence.insertMany([
      { id: e1, paymentId: p.id, userId, storagePath: `${userId}/payments/${p.id}/${e1}.jpg`, type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 42, originalFilename: 'slip.jpg', createdAt: now },
    ]);
    await repos.evidence.insertMany([]);
    expect((await repos.evidence.listByPayment(p.id, userId))[0]?.sizeBytes).toBe(42);
    expect(await repos.evidence.findById(e1, userId)).not.toBeNull();
    expect(await repos.evidence.findById(e1, otherUser)).toBeNull();
    expect(await repos.evidence.countByPaymentIds([p.id, randomUUID()], userId)).toEqual({ [p.id]: 1 });

    const replacement = pay('2026-09-04', '90');
    await repos.payments.insert(replacement);
    await repos.corrections.insert({ id: randomUUID(), userId, originalPaymentId: p.id, replacementPaymentId: replacement.id, reason: 'แก้', createdAt: now });
    expect((await repos.corrections.findByReplacement(replacement.id, userId))?.originalPaymentId).toBe(p.id);
  });

  it('rolls back the unit of work when a step throws', async () => {
    const uow = new DrizzleUnitOfWork(db);
    const p = pay('2026-10-01', '1');
    await expect(
      uow.run(async (r) => {
        await r.payments.insert(p);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repos.payments.findById(p.id, userId)).toBeNull();
  });
});
