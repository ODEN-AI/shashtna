#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/da91640c9eafe0e06d21c57669390b11804d709dc60efd36fe90721f0eb74f0b/contract';
import startContract from '../../snapshots/da91640c9eafe0e06d21c57669390b11804d709dc60efd36fe90721f0eb74f0b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ee3176d3c328a92a2dff5918330256ee1c8490da64d994c58cc51668fb801cf5/contract';
import endContract from '../../snapshots/ee3176d3c328a92a2dff5918330256ee1c8490da64d994c58cc51668fb801cf5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'automationRun',
        column: col('errorLog', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'automationRun',
        column: col('nextAttemptAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
