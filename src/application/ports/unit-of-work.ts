import type { Repositories } from './repositories';

export interface UnitOfWork {
  /** Runs fn inside one transaction; any thrown error rolls back. */
  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}
