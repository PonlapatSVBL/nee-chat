import type { Repositories } from '@/application/ports/repositories';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import type { Db } from '@/infrastructure/db/client';
import { makeRepositories } from './index';

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(makeRepositories(tx)));
  }
}
