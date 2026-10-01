#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8530c58f4b7c554bcf7b8addd20794c3ed4e557b37395df103242d381bff2dec/contract';
import endContract from '../../snapshots/8530c58f4b7c554bcf7b8addd20794c3ed4e557b37395df103242d381bff2dec/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/93deb767efc31169df25e26b9b2319262b747f72f105f9c9321200ded3d67ba6/contract';
import startContract from '../../snapshots/93deb767efc31169df25e26b9b2319262b747f72f105f9c9321200ded3d67ba6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'staffSessionRevocation',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('revokedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('revokedBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'staffSessionRevocation',
        constraint: 'staffSessionRevocation_userId_key',
        columns: ['userId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
