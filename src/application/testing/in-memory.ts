import type { Evidence } from '@/domain/evidence/evidence';
import type { Loan } from '@/domain/loan/loan';
import { sortChronologically } from '@/domain/ledger/ledger';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { Payment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import type { FileStorage, SignedUpload } from '@/application/ports/file-storage';
import type {
  CorrectionRepository,
  EvidenceRepository,
  LoanRepository,
  PaymentRepository,
  Repositories,
} from '@/application/ports/repositories';
import type { Clock, IdGenerator } from '@/application/ports/system';
import type { UnitOfWork } from '@/application/ports/unit-of-work';

export class InMemoryLoanRepository implements LoanRepository {
  readonly loans = new Map<string, Loan>();

  async findByUserId(userId: string): Promise<Loan | null> {
    return [...this.loans.values()].find((l) => l.userId === userId) ?? null;
  }

  async findById(id: string, userId: string): Promise<Loan | null> {
    const loan = this.loans.get(id);
    return loan && loan.userId === userId ? loan : null;
  }

  async save(loan: Loan): Promise<void> {
    this.loans.set(loan.id, loan);
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly payments = new Map<string, Payment>();
  failOnInsert = false;

  async findById(id: string, userId: string): Promise<Payment | null> {
    const p = this.payments.get(id);
    return p && p.userId === userId ? p : null;
  }

  async listByLoan(loanId: string, userId: string): Promise<Payment[]> {
    return [...this.payments.values()].filter((p) => p.loanId === loanId && p.userId === userId);
  }

  async findLatestActive(loanId: string, userId: string): Promise<Payment | null> {
    const active = (await this.listByLoan(loanId, userId)).filter((p) => p.status === 'ACTIVE');
    const sorted = sortChronologically(active);
    return sorted.length > 0 ? sorted[sorted.length - 1]! : null;
  }

  async insert(payment: Payment): Promise<void> {
    if (this.failOnInsert) throw new Error('simulated insert failure');
    if (this.payments.has(payment.id)) throw new Error(`duplicate payment id ${payment.id}`);
    this.payments.set(payment.id, payment);
  }

  async markVoided(payment: Payment): Promise<void> {
    if (!this.payments.has(payment.id)) throw new Error(`unknown payment ${payment.id}`);
    this.payments.set(payment.id, payment);
  }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  readonly items = new Map<string, Evidence>();

  async findById(id: string, userId: string): Promise<Evidence | null> {
    const e = this.items.get(id);
    return e && e.userId === userId ? e : null;
  }

  async listByPayment(paymentId: string, userId: string): Promise<Evidence[]> {
    return [...this.items.values()].filter((e) => e.paymentId === paymentId && e.userId === userId);
  }

  async insertMany(items: readonly Evidence[]): Promise<void> {
    for (const e of items) this.items.set(e.id, e);
  }

  async countByPaymentIds(paymentIds: readonly string[], userId: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const e of this.items.values()) {
      if (e.userId === userId && paymentIds.includes(e.paymentId)) {
        counts[e.paymentId] = (counts[e.paymentId] ?? 0) + 1;
      }
    }
    return counts;
  }
}

export class InMemoryCorrectionRepository implements CorrectionRepository {
  readonly items: PaymentCorrection[] = [];

  async insert(correction: PaymentCorrection): Promise<void> {
    this.items.push(correction);
  }

  async findByReplacement(replacementPaymentId: string, userId: string): Promise<PaymentCorrection | null> {
    return this.items.find((c) => c.replacementPaymentId === replacementPaymentId && c.userId === userId) ?? null;
  }
}

export class InMemoryFileStorage implements FileStorage {
  readonly files = new Set<string>();
  readonly deleted: string[] = [];

  async createSignedUploadUrl(path: string): Promise<SignedUpload> {
    return { url: `memory://upload/${path}`, token: `token-${path}` };
  }

  async createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    return `memory://read/${path}?expires=${expiresInSeconds}`;
  }

  async delete(paths: readonly string[]): Promise<void> {
    for (const p of paths) {
      this.files.delete(p);
      this.deleted.push(p);
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

export class FixedClock implements Clock {
  constructor(
    private readonly fixedNow: Date,
    private readonly fixedToday: DateOnly,
  ) {}

  now(): Date {
    return this.fixedNow;
  }

  today(): DateOnly {
    return this.fixedToday;
  }
}

export class SequenceIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    return fn(this.repos);
  }
}

export interface TestContext {
  repos: {
    loans: InMemoryLoanRepository;
    payments: InMemoryPaymentRepository;
    evidence: InMemoryEvidenceRepository;
    corrections: InMemoryCorrectionRepository;
  };
  uow: InMemoryUnitOfWork;
  storage: InMemoryFileStorage;
  clock: FixedClock;
  ids: SequenceIdGenerator;
}

export function makeTestContext(opts: { now?: Date; today?: DateOnly } = {}): TestContext {
  const repos = {
    loans: new InMemoryLoanRepository(),
    payments: new InMemoryPaymentRepository(),
    evidence: new InMemoryEvidenceRepository(),
    corrections: new InMemoryCorrectionRepository(),
  };
  return {
    repos,
    uow: new InMemoryUnitOfWork(repos),
    storage: new InMemoryFileStorage(),
    clock: new FixedClock(opts.now ?? new Date('2026-10-04T09:00:00Z'), opts.today ?? DateOnly.of('2026-10-04')),
    ids: new SequenceIdGenerator(),
  };
}
