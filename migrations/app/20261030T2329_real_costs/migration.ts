#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0395c5c66aa074ac9cb6f91abbdbb45a6b7a1d9886fe4178c293b0161f82b5c5/contract';
import startContract from '../../snapshots/0395c5c66aa074ac9cb6f91abbdbb45a6b7a1d9886fe4178c293b0161f82b5c5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/76e80bbd5844429e363e648371af22c236ec16159cd44d41918c8a95346d2dcd/contract';
import endContract from '../../snapshots/76e80bbd5844429e363e648371af22c236ec16159cd44d41918c8a95346d2dcd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'creditPurchase',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('creditCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('iqdPaid', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('purchasedOn', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'packageOption',
        column: col('creditCostCents', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('channel', 'text', {
          notNull: true,
          default: lit('SITE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('creditCostCents', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('creditCostIqd', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('creditPurchaseId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('supplierShareIqd', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'creditPurchase',
        index: 'creditPurchase_purchasedOn_idx_8771a6d2',
        columns: ['purchasedOn'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
