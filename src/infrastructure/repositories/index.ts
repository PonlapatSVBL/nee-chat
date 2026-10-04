import type { Repositories } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { DrizzleCorrectionRepository } from './drizzle-correction-repository';
import { DrizzleEvidenceRepository } from './drizzle-evidence-repository';
import { DrizzleLoanRepository } from './drizzle-loan-repository';
import { DrizzlePaymentRepository } from './drizzle-payment-repository';

export function makeRepositories(exec: DbExecutor): Repositories {
  return {
    loans: new DrizzleLoanRepository(exec),
    payments: new DrizzlePaymentRepository(exec),
    evidence: new DrizzleEvidenceRepository(exec),
    corrections: new DrizzleCorrectionRepository(exec),
  };
}
