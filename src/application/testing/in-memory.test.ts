import { describe, expect, it } from 'vitest';
import { createLoan } from '@/domain/loan/loan';
import { createPayment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { makeTestContext } from './in-memory';

describe('in-memory test doubles', () => {
  it('scopes reads by userId and sorts latest active payment', async () => {
    const { repos, clock, ids } = makeTestContext();
    const loan = createLoan(
      { name: 'x', loanNumber: null, openingBalance: Money.of('10'), openingBalanceDate: DateOnly.of('2026-01-01'), defaultAmount: null },
      { id: ids.next(), userId: 'u1', now: clock.now() },
    );
    await repos.loans.save(loan);
    expect(await repos.loans.findByUserId('u1')).toEqual(loan);
    expect(await repos.loans.findByUserId('u2')).toBeNull();

    const mk = (id: string, paidAt: string) =>
      createPayment(
        { paidAt: DateOnly.of(paidAt), amount: Money.of('1'), paymentMethod: 'ATM', referenceNo: null, notes: null },
        { id, loanId: loan.id, userId: 'u1', now: clock.now() },
      );
    await repos.payments.insert(mk('a', '2026-02-01'));
    await repos.payments.insert(mk('b', '2026-03-01'));
    expect((await repos.payments.findLatestActive(loan.id, 'u1'))?.id).toBe('b');
    expect(await repos.payments.findById('a', 'u2')).toBeNull();
  });

  it('counts evidence per payment and tracks storage deletes', async () => {
    const { repos, storage } = makeTestContext();
    await repos.evidence.insertMany([
      { id: 'e1', paymentId: 'p1', userId: 'u1', storagePath: 'u1/payments/p1/a.jpg', type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null, createdAt: new Date() },
      { id: 'e2', paymentId: 'p1', userId: 'u1', storagePath: 'u1/payments/p1/b.jpg', type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null, createdAt: new Date() },
    ]);
    expect(await repos.evidence.countByPaymentIds(['p1', 'p2'], 'u1')).toEqual({ p1: 2 });
    storage.files.add('u1/payments/p1/a.jpg');
    await storage.delete(['u1/payments/p1/a.jpg']);
    expect(await storage.exists('u1/payments/p1/a.jpg')).toBe(false);
    expect(storage.deleted).toEqual(['u1/payments/p1/a.jpg']);
  });

  it('insertMany with an empty list is a no-op and failOnInsert simulates persistence failure', async () => {
    const { repos, clock, ids } = makeTestContext();
    await repos.evidence.insertMany([]);
    expect(await repos.evidence.countByPaymentIds(['p1'], 'u1')).toEqual({});

    repos.payments.failOnInsert = true;
    const p = createPayment(
      { paidAt: DateOnly.of('2026-01-01'), amount: Money.of('1'), paymentMethod: 'ATM', referenceNo: null, notes: null },
      { id: ids.next(), loanId: 'l1', userId: 'u1', now: clock.now() },
    );
    await expect(repos.payments.insert(p)).rejects.toThrow('simulated insert failure');
  });

  it('unit of work does not roll back (documented limitation)', async () => {
    const { repos, uow, clock, ids } = makeTestContext();
    const p = createPayment(
      { paidAt: DateOnly.of('2026-01-01'), amount: Money.of('1'), paymentMethod: 'ATM', referenceNo: null, notes: null },
      { id: ids.next(), loanId: 'l1', userId: 'u1', now: clock.now() },
    );
    await expect(
      uow.run(async (r) => {
        await r.payments.insert(p);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repos.payments.findById(p.id, 'u1')).not.toBeNull();
  });
});
