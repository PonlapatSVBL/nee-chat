import 'server-only';
import type { FileStorage } from '@/application/ports/file-storage';
import type { EvidenceRepository, LoanRepository } from '@/application/ports/repositories';
import type { Clock } from '@/application/ports/system';
import { GetLoan } from '@/application/use-cases/loan/get-loan';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { UpdateLoan } from '@/application/use-cases/loan/update-loan';
import { CorrectPayment } from '@/application/use-cases/payment/correct-payment';
import { PrepareEvidenceUpload } from '@/application/use-cases/payment/prepare-evidence-upload';
import { RecordPayment } from '@/application/use-cases/payment/record-payment';
import { VoidPayment } from '@/application/use-cases/payment/void-payment';
import { GetDashboard } from '@/application/use-cases/query/get-dashboard';
import { GetPaymentDetail } from '@/application/use-cases/query/get-payment-detail';
import { ListPayments } from '@/application/use-cases/query/list-payments';
import { createDb } from '@/infrastructure/db/client';
import { makeRepositories } from '@/infrastructure/repositories';
import { DrizzleUnitOfWork } from '@/infrastructure/repositories/unit-of-work';
import { SupabaseFileStorage } from '@/infrastructure/storage/supabase-file-storage';
import { createServiceClient } from '@/infrastructure/supabase/service-client.server';
import { SystemClock } from '@/infrastructure/system/clock';
import { UuidIdGenerator } from '@/infrastructure/system/ids';

export interface Container {
  readonly loans: LoanRepository;
  readonly evidence: EvidenceRepository;
  readonly storage: FileStorage;
  readonly clock: Clock;
  readonly getLoan: GetLoan;
  readonly setupLoan: SetupLoan;
  readonly updateLoan: UpdateLoan;
  readonly prepareEvidenceUpload: PrepareEvidenceUpload;
  readonly recordPayment: RecordPayment;
  readonly correctPayment: CorrectPayment;
  readonly voidPayment: VoidPayment;
  readonly getDashboard: GetDashboard;
  readonly listPayments: ListPayments;
  readonly getPaymentDetail: GetPaymentDetail;
}

let cached: Container | undefined;

export function getContainer(): Container {
  if (cached) return cached;
  const db = createDb();
  const repos = makeRepositories(db);
  const uow = new DrizzleUnitOfWork(db);
  const storage = new SupabaseFileStorage(createServiceClient());
  const clock = new SystemClock();
  const ids = new UuidIdGenerator();

  cached = {
    loans: repos.loans,
    evidence: repos.evidence,
    storage,
    clock,
    getLoan: new GetLoan(repos.loans),
    setupLoan: new SetupLoan(repos.loans, ids, clock),
    updateLoan: new UpdateLoan(repos.loans, clock),
    prepareEvidenceUpload: new PrepareEvidenceUpload(storage, ids),
    recordPayment: new RecordPayment(repos.loans, uow, storage, ids, clock),
    correctPayment: new CorrectPayment(uow, storage, ids, clock),
    voidPayment: new VoidPayment(uow, ids, clock),
    getDashboard: new GetDashboard(repos.loans, repos.payments),
    listPayments: new ListPayments(repos.loans, repos.payments, repos.evidence),
    getPaymentDetail: new GetPaymentDetail(repos.loans, repos.payments, repos.evidence, repos.corrections, storage),
  };
  return cached;
}
