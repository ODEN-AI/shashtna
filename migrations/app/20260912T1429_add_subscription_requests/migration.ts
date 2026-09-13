#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a6e9dbaaed92f2c8353ab2feb57aec20d8535310385cea059a799f5d8c79e793/contract';
import endContract from '../../snapshots/a6e9dbaaed92f2c8353ab2feb57aec20d8535310385cea059a799f5d8c79e793/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e67f3c26e050552e9f6d9f0e7998d4c6941c34292d65034b83770456870ff9ed/contract';
import startContract from '../../snapshots/e67f3c26e050552e9f6d9f0e7998d4c6941c34292d65034b83770456870ff9ed/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'subscriptionRequest',
        columns: [
          col('contactMethod', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('durationLabel', 'text', {
            notNull: true,
            default: lit('1 Year'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('durationMonths', 'int4', {
            notNull: true,
            default: lit(12),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('planSlug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('serviceName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscriptionRequest',
        index: 'subscriptionRequest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'subscriptionRequest',
        foreignKey: {
          name: 'subscriptionRequest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
