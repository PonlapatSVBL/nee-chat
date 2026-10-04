import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { CorrectPayment } from '@/application/use-cases/payment/correct-payment';
import { RecordPayment } from '@/application/use-cases/payment/record-payment';
import { GetDashboard } from './get-dashboard';
import { GetPaymentDetail } from './get-payment-detail';
import { ListPayments } from './list-payments';

describe('query use cases', () => {
  let ctx: TestContext;
  let loanId: string;

  beforeEach(async () => {
    ctx = makeTestContext();
    const loan = await new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock).execute({
      userId: 'u1', name: 'กยศ.', loanNumber: null, openingBalance: '195420.50', openingBalanceDate: '2026-06-30', defaultAmount: '3000',
    });
    if (!loan.ok) throw loan.error;
    loanId = loan.value.loanId;
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    for (const [id, paidAt] of [['p1', '2026-07-04'], ['p2', '2026-08-04'], ['p3', '2026-09-04']] as const) {
      const r = await record.execute({
        userId: 'u1', loanId, paymentId: id, paidAt, amount: '3000', paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null,
        evidence: id === 'p3' ? [{ fileId: 'f3', storagePath: `u1/payments/p3/f3.jpg`, mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }] : [],
      });
      if (!r.ok) throw r.error;
    }
  });

  it('GetDashboard summarises the loan', async () => {
    const r = await new GetDashboard(ctx.repos.loans, ctx.repos.payments).execute({ userId: 'u1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.summary.ledgerBalance.toString()).toBe('186420.50');
    expect(r.value.summary.paymentCount).toBe(3);
    expect(r.value.summary.latestPayment?.id).toBe('p3');
    const none = await new GetDashboard(ctx.repos.loans, ctx.repos.payments).execute({ userId: 'u2' });
    expect(none.ok).toBe(false);
  });

  it('ListPayments returns grouped timeline and evidence counts', async () => {
    const r = await new ListPayments(ctx.repos.loans, ctx.repos.payments, ctx.repos.evidence).execute({ userId: 'u1', includeVoided: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.groups.map((g) => g.month)).toEqual([9, 8, 7]);
    expect(r.value.evidenceCount).toEqual({ p3: 1 });
  });

  it('GetPaymentDetail resolves evidence URLs, balance and correction links', async () => {
    const corrected = await new CorrectPayment(ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', originalPaymentId: 'p3', newPaymentId: 'p4', reason: 'พิมพ์ผิด',
      paidAt: '2026-09-04', amount: '2500', paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null, newEvidence: [],
    });
    if (!corrected.ok) throw corrected.error;

    const detail = new GetPaymentDetail(ctx.repos.loans, ctx.repos.payments, ctx.repos.evidence, ctx.repos.corrections, ctx.storage);
    const replacement = await detail.execute({ userId: 'u1', paymentId: 'p4' });
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;
    expect(replacement.value.balanceAfter?.toString()).toBe('186920.50');
    expect(replacement.value.evidence).toHaveLength(1);
    expect(replacement.value.evidence[0]?.url).toContain('u1/payments/p3/f3.jpg');
    expect(replacement.value.correctedFrom?.id).toBe('p3');
    expect(replacement.value.correctionReason).toBe('พิมพ์ผิด');
    expect(replacement.value.replacedBy).toBeNull();

    const original = await detail.execute({ userId: 'u1', paymentId: 'p3' });
    if (!original.ok) throw original.error;
    expect(original.value.payment.status).toBe('VOIDED');
    expect(original.value.balanceAfter).toBeNull();
    expect(original.value.replacedBy?.id).toBe('p4');
    expect(original.value.correctionReason).toBe('พิมพ์ผิด');

    const missing = await detail.execute({ userId: 'u1', paymentId: 'nope' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('PAYMENT_NOT_FOUND');
  });
});
