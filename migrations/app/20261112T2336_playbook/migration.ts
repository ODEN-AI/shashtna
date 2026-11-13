#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e5c01d610ff75d1b39be58e62185b2cd18c8ac65d953ae1773ea2c58645451ab/contract';
import endContract from '../../snapshots/e5c01d610ff75d1b39be58e62185b2cd18c8ac65d953ae1773ea2c58645451ab/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ee3176d3c328a92a2dff5918330256ee1c8490da64d994c58cc51668fb801cf5/contract';
import startContract from '../../snapshots/ee3176d3c328a92a2dff5918330256ee1c8490da64d994c58cc51668fb801cf5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'playbookEntry',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('keywords', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('service', 'text', {
            notNull: true,
            default: lit('ALL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'playbookEntry',
        index: 'playbookEntry_kind_idx_c9ca668f',
        columns: ['kind'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
