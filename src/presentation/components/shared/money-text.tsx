import type { Money } from '@/domain/shared/money';
import { formatAmount } from '@/presentation/view-models/format';
import { cn } from '@/presentation/lib/utils';

export function MoneyText({ amount, size = 'md', className }: { amount: Money | string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl font-semibold',
    xl: 'text-4xl font-semibold tracking-[-0.02em]',
  };
  // The unit shrinks as the figure grows so "บาท" never competes with the number.
  const unit = { sm: 'text-[0.85em]', md: 'text-[0.85em]', lg: 'text-[0.6em]', xl: 'text-[0.5em]' };
  return (
    <span className={cn('whitespace-nowrap tabular-nums', sizes[size], className)}>
      {formatAmount(amount)} <span className={cn(unit[size], 'font-normal tracking-normal text-muted-foreground')}>บาท</span>
    </span>
  );
}
