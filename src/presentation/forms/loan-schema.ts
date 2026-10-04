import { z } from 'zod';

export const MONEY_PATTERN = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_MESSAGE = 'กรอกตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง';

export const moneyString = z.string().trim().min(1, 'กรุณากรอกจำนวนเงิน').regex(MONEY_PATTERN, MONEY_MESSAGE);
export const optionalMoneyString = z.string().trim().refine((v) => v === '' || MONEY_PATTERN.test(v), MONEY_MESSAGE);
export const isoDateString = z.string().regex(ISO_DATE_PATTERN, 'กรุณาเลือกวันที่');

export const loanFormSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อเงินกู้').max(100, 'ชื่อยาวเกินไป'),
  loanNumber: z.string().trim().max(50, 'เลขสัญญายาวเกินไป'),
  openingBalance: moneyString,
  openingBalanceDate: isoDateString,
  defaultAmount: optionalMoneyString,
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

export function formDataToLoanValues(fd: FormData): LoanFormValues {
  return {
    name: str(fd, 'name'),
    loanNumber: str(fd, 'loanNumber'),
    openingBalance: str(fd, 'openingBalance'),
    openingBalanceDate: str(fd, 'openingBalanceDate'),
    defaultAmount: str(fd, 'defaultAmount'),
  };
}
