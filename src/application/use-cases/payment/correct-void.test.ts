import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { CorrectPayment } from './correct-payment';
import { RecordPayment } from './record-payment';
import { VoidPayment } from './void-payment';

describe('VoidPayment / CorrectPayment', () => {
  let ctx: TestContext;
  let loanId: string;
  let paymentId: string;

  beforeEach(async () => {
    ctx = makeTestContext();
    const loan = await new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock).execute({
      userId: 'u1', name: 'กยศ.', loanNumber: null, openingBalance: '195420.50', openingBalanceDate: '2026-06-30', defaultAmount: '3000',
    });
    if (!loan.ok) throw loan.error;
    loanId = loan.value.loanId;
    const recorded = await new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', loanId, paymentId: 'p1', paidAt: '2026-10-04', amount: '3000', paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null,
      evidence: [{ fileId: 'f1', storagePath: 'u1/payments/p1/f1.jpg', mimeType: 'image/jpeg', sizeBytes: 10, originalFilename: 'a.jpg' }],
    });
    if (!recorded.ok) throw recorded.error;
    paymentId = recorded.value.paymentId;
  });

  it('VoidPayment marks VOIDED and records a correction without replacement', async () => {
    const r = await new VoidPayment(ctx.uow, ctx.ids, ctx.clock).execute({ userId: 'u1', paymentId, reason: 'บันทึกซ้ำ' });
    expect(r.ok).toBe(true);
    const p = await ctx.repos.payments.findById(paymentId, 'u1');
    expect(p?.status).toBe('VOIDED');
    expect(p?.voidReason).toBe('บันทึกซ้ำ');
    expect(p?.replacedByPaymentId).toBeNull();
    expect(ctx.repos.corrections.items).toHaveLength(1);
    expect(ctx.repos.corrections.items[0]?.replacementPaymentId).toBeNull();
  });

  it('VoidPayment refuses other users, unknown ids, empty reason and double void', async () => {
    const vp = new VoidPayment(ctx.uow, ctx.ids, ctx.clock);
    const other = await vp.execute({ userId: 'u2', paymentId, reason: 'x' });
    if (!other.ok) expect(other.error.code).toBe('PAYMENT_NOT_FOUND');
    const empty = await vp.execute({ userId: 'u1', paymentId, reason: ' ' });
    if (!empty.ok) expect(empty.error.code).toBe('REASON_REQUIRED');
    expect((await vp.execute({ userId: 'u1', paymentId, reason: 'x' })).ok).toBe(true);
    const twice = await vp.execute({ userId: 'u1', paymentId, reason: 'y' });
    if (!twice.ok) expect(twice.error.code).toBe('PAYMENT_ALREADY_VOIDED');
    expect([other.ok, empty.ok, twice.ok]).toEqual([false, false, false]);
  });

  it('CorrectPayment voids the original, creates a replacement, copies evidence and links them', async () => {
    const r = await new CorrectPayment(ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', originalPaymentId: paymentId, newPaymentId: 'p2', reason: 'พิมพ์ยอดผิด',
      paidAt: '2026-10-04', amount: '2500', paymentMethod: 'MOBILE_BANKING', referenceNo: 'REF2', notes: null,
      newEvidence: [{ fileId: 'f2', storagePath: 'u1/payments/p2/f2.png', mimeType: 'image/png', sizeBytes: 5, originalFilename: null }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.paymentId).toBe('p2');

    const original = await ctx.repos.payments.findById(paymentId, 'u1');
    expect(original?.status).toBe('VOIDED');
    expect(original?.replacedByPaymentId).toBe('p2');

    const replacement = await ctx.repos.payments.findById('p2', 'u1');
    expect(replacement?.amount.toString()).toBe('2500.00');
    expect(replacement?.loanId).toBe(loanId);

    const evidence = await ctx.repos.evidence.listByPayment('p2', 'u1');
    expect(evidence.map((e) => e.storagePath).sort()).toEqual(['u1/payments/p1/f1.jpg', 'u1/payments/p2/f2.png']);

    const correction = await ctx.repos.corrections.findByReplacement('p2', 'u1');
    expect(correction?.originalPaymentId).toBe(paymentId);
    expect(correction?.reason).toBe('พิมพ์ยอดผิด');
  });

  it('CorrectPayment rejects already-voided originals and cleans up new files on failure', async () => {
    await new VoidPayment(ctx.uow, ctx.ids, ctx.clock).execute({ userId: 'u1', paymentId, reason: 'x' });
    const cp = new CorrectPayment(ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const voided = await cp.execute({
      userId: 'u1', originalPaymentId: paymentId, newPaymentId: 'p3', reason: 'y',
      paidAt: '2026-10-04', amount: '1', paymentMethod: 'ATM', referenceNo: null, notes: null, newEvidence: [],
    });
    expect(voided.ok).toBe(false);
    if (!voided.ok) expect(voided.error.code).toBe('PAYMENT_ALREADY_VOIDED');

    // already-voided original with newly uploaded files: delete only the new files
    const withFiles = await cp.execute({
      userId: 'u1', originalPaymentId: paymentId, newPaymentId: 'p3b', reason: 'y',
      paidAt: '2026-10-04', amount: '1', paymentMethod: 'ATM', referenceNo: null, notes: null,
      newEvidence: [{ fileId: 'f3b', storagePath: 'u1/payments/p3b/f3b.jpg', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(withFiles.ok).toBe(false);
    if (!withFiles.ok) expect(withFiles.error.code).toBe('PAYMENT_ALREADY_VOIDED');
    expect(ctx.storage.deleted).toContain('u1/payments/p3b/f3b.jpg');
    expect(ctx.storage.deleted).not.toContain('u1/payments/p1/f1.jpg');

    // fresh active payment, then force persistence failure
    const recorded = await new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', loanId, paymentId: 'p4', paidAt: '2026-10-01', amount: '100', paymentMethod: 'ATM', referenceNo: null, notes: null, evidence: [],
    });
    if (!recorded.ok) throw recorded.error;
    ctx.repos.payments.failOnInsert = true;
    const failed = await cp.execute({
      userId: 'u1', originalPaymentId: 'p4', newPaymentId: 'p5', reason: 'z',
      paidAt: '2026-10-01', amount: '90', paymentMethod: 'ATM', referenceNo: null, notes: null,
      newEvidence: [{ fileId: 'f5', storagePath: 'u1/payments/p5/f5.jpg', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('PERSISTENCE_FAILED');
    expect(ctx.storage.deleted).toContain('u1/payments/p5/f5.jpg');
    expect((await ctx.repos.payments.findById('p4', 'u1'))?.status).toBe('ACTIVE');
  });
});
