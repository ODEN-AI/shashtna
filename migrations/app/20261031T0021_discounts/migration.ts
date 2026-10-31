#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/76e80bbd5844429e363e648371af22c236ec16159cd44d41918c8a95346d2dcd/contract';
import startContract from '../../snapshots/76e80bbd5844429e363e648371af22c236ec16159cd44d41918c8a95346d2dcd/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eb9bf30b7888769924bb5c75d3d0a0c9367da8fdf1aa10e55fabdee317351cda/contract';
import endContract from '../../snapshots/eb9bf30b7888769924bb5c75d3d0a0c9367da8fdf1aa10e55fabdee317351cda/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'discount',
        columns: [
          col('appliesToRenewals', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('endedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('endsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('packageOptionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('value', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('discountId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('discountIqd', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('listPrice', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'discount',
        index: 'discount_packageOptionId_idx_398e19b0',
        columns: ['packageOptionId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
