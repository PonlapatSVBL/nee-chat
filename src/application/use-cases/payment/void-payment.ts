import { voidPayment } from '@/domain/payment/payment';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { Clock, IdGenerator } from '@/application/ports/system';
import type { UnitOfWork } from '@/application/ports/unit-of-work';

export class VoidPayment {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: { userId: string; paymentId: string; reason: string }): Promise<Result<void>> {
    const now = this.clock.now();
    try {
      return await this.uow.run(async (repos) => {
        const payment = await repos.payments.findById(input.paymentId, input.userId);
        if (!payment) return err(new DomainError('PAYMENT_NOT_FOUND', 'ไม่พบรายการชำระ'));

        const voided = voidPayment(payment, input.reason, now, null);
        if (!voided.ok) return err(voided.error);

        await repos.payments.markVoided(voided.value);
        await repos.corrections.insert({
          id: this.ids.next(),
          userId: input.userId,
          originalPaymentId: payment.id,
          replacementPaymentId: null,
          reason: voided.value.voidReason ?? input.reason.trim(),
          createdAt: now,
        });
        return ok(undefined);
      });
    } catch (cause) {
      return err(new DomainError('PERSISTENCE_FAILED', `ยกเลิกรายการไม่สำเร็จ: ${String(cause)}`));
    }
  }
}
