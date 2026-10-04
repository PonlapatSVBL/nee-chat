import { z } from 'zod';
import { PAYMENT_METHODS } from '@/domain/payment/payment';
import { isoDateString, moneyString } from './loan-schema';

export const paymentFormSchema = z.object({
  paidAt: isoDateString,
  amount: moneyString,
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'กรุณาเลือกช่องทางการชำระ' }),
  referenceNo: z.string().trim().max(100, 'เลขอ้างอิงยาวเกินไป'),
  notes: z.string().trim().max(500, 'หมายเหตุยาวเกินไป'),
  reason: z.string().trim().max(500, 'เหตุผลยาวเกินไป'),
});

export const correctionFormSchema = paymentFormSchema.extend({
  reason: z.string().trim().min(1, 'กรุณาระบุเหตุผลที่แก้ไข').max(500, 'เหตุผลยาวเกินไป'),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
