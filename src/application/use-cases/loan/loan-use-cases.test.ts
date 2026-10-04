import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { GetLoan } from './get-loan';
import { SetupLoan } from './setup-loan';
import { UpdateLoan } from './update-loan';

const input = {
  userId: 'u1',
  name: 'กยศ. ของฉัน',
  loanNumber: null,
  openingBalance: '195,420.50',
  openingBalanceDate: '2026-06-30',
  defaultAmount: '3000',
};

describe('loan use cases', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = makeTestContext();
  });

  it('SetupLoan creates one loan per user', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const r = await setup.execute(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const loan = await new GetLoan(ctx.repos.loans).execute('u1');
    expect(loan?.id).toBe(r.value.loanId);
    expect(loan?.openingBalance.toString()).toBe('195420.50');
    expect(loan?.defaultAmount?.toString()).toBe('3000.00');

    const again = await setup.execute(input);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('LOAN_ALREADY_EXISTS');
  });

  it('SetupLoan rejects invalid money / date / name', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const badMoney = await setup.execute({ ...input, openingBalance: 'abc' });
    expect(badMoney.ok).toBe(false);
    if (!badMoney.ok) expect(badMoney.error.code).toBe('INVALID_AMOUNT');
    const badDate = await setup.execute({ ...input, openingBalanceDate: '30/06/2026' });
    expect(badDate.ok).toBe(false);
    if (!badDate.ok) expect(badDate.error.code).toBe('INVALID_DATE');
    const badName = await setup.execute({ ...input, name: '' });
    expect(badName.ok).toBe(false);
    if (!badName.ok) expect(badName.error.code).toBe('INVALID_NAME');
  });

  it('UpdateLoan changes fields and rejects unknown loan', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const created = await setup.execute(input);
    if (!created.ok) throw created.error;
    const update = new UpdateLoan(ctx.repos.loans, ctx.clock);
    const r = await update.execute({ ...input, loanId: created.value.loanId, name: 'เปลี่ยนชื่อ', defaultAmount: null });
    expect(r.ok).toBe(true);
    const loan = await new GetLoan(ctx.repos.loans).execute('u1');
    expect(loan?.name).toBe('เปลี่ยนชื่อ');
    expect(loan?.defaultAmount).toBeNull();

    const missing = await update.execute({ ...input, loanId: 'nope' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('LOAN_NOT_FOUND');
    const otherUser = await update.execute({ ...input, loanId: created.value.loanId, userId: 'u2' });
    expect(otherUser.ok).toBe(false);
    if (!otherUser.ok) expect(otherUser.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('SetupLoan treats whitespace defaultAmount as none and rejects invalid defaultAmount', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const blank = await setup.execute({ ...input, defaultAmount: '   ' });
    expect(blank.ok).toBe(true);
    expect((await new GetLoan(ctx.repos.loans).execute('u1'))?.defaultAmount).toBeNull();

    const other = makeTestContext();
    const bad = await new SetupLoan(other.repos.loans, other.ids, other.clock).execute({ ...input, defaultAmount: 'abc' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_AMOUNT');
  });
});
