#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/20a451c5884d7668f7907cde69135a5211670159d83cc542ec2c90d4ef725f9e/contract';
import endContract from '../../snapshots/20a451c5884d7668f7907cde69135a5211670159d83cc542ec2c90d4ef725f9e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/409655cdc01875a113e9a0f4649a34eef07b344c552f31b39323737dfcd145b5/contract';
import startContract from '../../snapshots/409655cdc01875a113e9a0f4649a34eef07b344c552f31b39323737dfcd145b5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'announcement',
        column: col('audience', 'text', {
          notNull: true,
          default: lit('ALL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'announcement',
        column: col('highlight', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'announcement',
        column: col('mediaType', 'text', {
          notNull: true,
          default: lit('IMAGE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'announcement',
        column: col('videoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
