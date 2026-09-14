#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1b8422414561e16bebdffafd727686bdaedebfbc48f102cc66aefca411806ace/contract';
import startContract from '../../snapshots/1b8422414561e16bebdffafd727686bdaedebfbc48f102cc66aefca411806ace/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9e027464add9e0070d5e6266440c170155e6e07fff422f670d423916a6c97022/contract';
import endContract from '../../snapshots/9e027464add9e0070d5e6266440c170155e6e07fff422f670d423916a6c97022/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'receipt',
        column: col('bonusYears', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('bonusYears', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
