#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/925d49f5ab874d5f0eb183337be5531d07d3676fbc8020f2ee52bb602bb545e6/contract';
import endContract from '../../snapshots/925d49f5ab874d5f0eb183337be5531d07d3676fbc8020f2ee52bb602bb545e6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/aecfefce425c7089070c55e65decc0396065142c508f780f6c6e7fa6c785619f/contract';
import startContract from '../../snapshots/aecfefce425c7089070c55e65decc0396065142c508f780f6c6e7fa6c785619f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'subscriptionTerm',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endsOn', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('matchesExpiry', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('months', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('receiptId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('serviceType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', {
            notNull: true,
            default: lit('ACTIVATION'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('startsOn', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subscriptionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'subscriptionTerm',
        constraint: 'subscriptionTerm_receiptId_key',
        columns: ['receiptId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscriptionTerm',
        index: 'subscriptionTerm_endsOn_idx_e3aee019',
        columns: ['endsOn'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscriptionTerm',
        index: 'subscriptionTerm_subscriptionId_idx_edbe96bf',
        columns: ['subscriptionId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
