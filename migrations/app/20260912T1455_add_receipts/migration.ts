#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract';
import endContract from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a6e9dbaaed92f2c8353ab2feb57aec20d8535310385cea059a799f5d8c79e793/contract';
import startContract from '../../snapshots/a6e9dbaaed92f2c8353ab2feb57aec20d8535310385cea059a799f5d8c79e793/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'receipt',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('durationLabel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('durationMonths', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('receiptNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('serviceName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PAID'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subscriptionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'receipt',
        constraint: 'receipt_receiptNumber_key',
        columns: ['receiptNumber'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
