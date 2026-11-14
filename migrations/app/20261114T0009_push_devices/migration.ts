#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/509bf3c557e5b49aca5cee44925f4eeafee8cf5aa5888ddf4e76b52230de9cc3/contract';
import endContract from '../../snapshots/509bf3c557e5b49aca5cee44925f4eeafee8cf5aa5888ddf4e76b52230de9cc3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/925d49f5ab874d5f0eb183337be5531d07d3676fbc8020f2ee52bb602bb545e6/contract';
import startContract from '../../snapshots/925d49f5ab874d5f0eb183337be5531d07d3676fbc8020f2ee52bb602bb545e6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'pushDevice',
        columns: [
          col('appVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('platform', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'pushDevice',
        constraint: 'pushDevice_token_key',
        columns: ['token'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'pushDevice',
        index: 'pushDevice_userId_idx_a489d58a',
        columns: ['userId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
