import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { PrepareEvidenceUpload } from './prepare-evidence-upload';
import { RecordPayment } from './record-payment';

describe('RecordPayment', () => {
  let ctx: TestContext;
  let loanId: string;

  beforeEach(async () => {
    ctx = makeTestContext();
    const r = await new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock).execute({
      userId: 'u1', name: 'กยศ.', loanNumber: null, openingBalance: '195420.50', openingBalanceDate: '2026-06-30', defaultAmount: '3000',
    });
    if (!r.ok) throw r.error;
    loanId = r.value.loanId;
  });

  const base = {
    userId: 'u1',
    paidAt: '2026-10-04',
    amount: '3,000',
    paymentMethod: 'MOBILE_BANKING',
    referenceNo: 'REF1',
    notes: 'ชำระงวดเดือน ต.ค. 2569',
  };

  it('records a payment with uploaded evidence in one unit of work', async () => {
    const prepare = new PrepareEvidenceUpload(ctx.storage, ctx.ids);
    const prepared = await prepare.execute({ userId: 'u1', paymentId: null, mimeType: 'image/jpeg', sizeBytes: 1000 });
    if (!prepared.ok) throw prepared.error;
    expect(prepared.value.storagePath).toBe(`u1/payments/${prepared.value.paymentId}/${prepared.value.fileId}.jpg`);
    expect(prepared.value.uploadUrl).toContain(prepared.value.storagePath);

    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base,
      loanId,
      paymentId: prepared.value.paymentId,
      evidence: [{ fileId: prepared.value.fileId, storagePath: prepared.value.storagePath, mimeType: 'image/jpeg', sizeBytes: 1000, originalFilename: 'slip.jpg' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.paymentId).toBe(prepared.value.paymentId);
    const stored = await ctx.repos.payments.findById(r.value.paymentId, 'u1');
    expect(stored?.amount.toString()).toBe('3000.00');
    expect(stored?.status).toBe('ACTIVE');
    const evidence = await ctx.repos.evidence.listByPayment(r.value.paymentId, 'u1');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.type).toBe('PAYMENT_SLIP');
  });

  it('records without evidence and generates a payment id', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({ ...base, loanId, paymentId: null, evidence: [] });
    expect(r.ok).toBe(true);
  });

  it('rejects evidence paths that belong to another user or payment', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base, loanId, paymentId: 'p-mine',
      evidence: [{ fileId: 'f', storagePath: 'u2/payments/p-mine/f.jpg', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_EVIDENCE_PATH');
  });

  it('rejects a same-user path that belongs to another payment', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base, loanId, paymentId: 'p-mine',
      evidence: [{ fileId: 'f', storagePath: 'u1/payments/OTHER/f.jpg', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_EVIDENCE_PATH');
  });

  it('PrepareEvidenceUpload rejects unsupported types and oversize files', async () => {
    const prepare = new PrepareEvidenceUpload(ctx.storage, ctx.ids);
    const gif = await prepare.execute({ userId: 'u1', paymentId: null, mimeType: 'image/gif', sizeBytes: 10 });
    expect(gif.ok).toBe(false);
    if (!gif.ok) expect(gif.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    const big = await prepare.execute({ userId: 'u1', paymentId: null, mimeType: 'image/jpeg', sizeBytes: 5_242_881 });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error.code).toBe('FILE_TOO_LARGE');
  });

  it('deletes already-uploaded files when the domain refuses (future date)', async () => {
    const path = 'u1/payments/p-future/f1.jpg';
    ctx.storage.files.add(path);
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base, loanId, paymentId: 'p-future', paidAt: '2026-10-05',
      evidence: [{ fileId: 'f1', storagePath: path, mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FUTURE_DATE');
    expect(ctx.storage.deleted).toContain(path);
  });

  it('refuses a payment id that already exists without touching storage', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const first = await record.execute({ ...base, loanId, paymentId: 'p-dup', evidence: [] });
    expect(first.ok).toBe(true);
    const path = 'u1/payments/p-dup/f9.jpg';
    ctx.storage.files.add(path);
    const second = await record.execute({
      ...base, loanId, paymentId: 'p-dup',
      evidence: [{ fileId: 'f9', storagePath: path, mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('PERSISTENCE_FAILED');
    expect(ctx.storage.deleted).toEqual([]);
  });

  it('rejects unknown loan, bad method, future date', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const noLoan = await record.execute({ ...base, loanId: 'x', paymentId: null, evidence: [] });
    if (!noLoan.ok) expect(noLoan.error.code).toBe('LOAN_NOT_FOUND');
    const badMethod = await record.execute({ ...base, loanId, paymentId: null, evidence: [], paymentMethod: 'CASH' });
    if (!badMethod.ok) expect(badMethod.error.code).toBe('INVALID_PAYMENT_METHOD');
    const future = await record.execute({ ...base, loanId, paymentId: null, evidence: [], paidAt: '2026-10-05' });
    if (!future.ok) expect(future.error.code).toBe('FUTURE_DATE');
    expect([noLoan.ok, badMethod.ok, future.ok]).toEqual([false, false, false]);
  });

  it('deletes uploaded files when persistence fails', async () => {
    ctx.repos.payments.failOnInsert = true;
    const path = 'u1/payments/p1/f1.jpg';
    ctx.storage.files.add(path);
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base, loanId, paymentId: 'p1',
      evidence: [{ fileId: 'f1', storagePath: path, mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PERSISTENCE_FAILED');
    expect(ctx.storage.deleted).toEqual([path]);
  });
});
