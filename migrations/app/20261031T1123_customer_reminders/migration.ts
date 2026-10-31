#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0102955a274660919ea2e2dcb51d26def14278de5b5ebeeb65280c2ad8497bec/contract';
import startContract from '../../snapshots/0102955a274660919ea2e2dcb51d26def14278de5b5ebeeb65280c2ad8497bec/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/da91640c9eafe0e06d21c57669390b11804d709dc60efd36fe90721f0eb74f0b/contract';
import endContract from '../../snapshots/da91640c9eafe0e06d21c57669390b11804d709dc60efd36fe90721f0eb74f0b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('reminderOutboxId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
