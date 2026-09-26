#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/015a5832697de1be26de4c7d49e81af3fa770ab6ebb1479f7d7081bb1b439d22/contract';
import endContract from '../../snapshots/015a5832697de1be26de4c7d49e81af3fa770ab6ebb1479f7d7081bb1b439d22/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f4669d3363071f50d9cd7599bf94b8eed83af688790424d958af4038792968ae/contract';
import startContract from '../../snapshots/f4669d3363071f50d9cd7599bf94b8eed83af688790424d958af4038792968ae/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('failedLogins', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('lockedUntil', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('tokenVersion', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
