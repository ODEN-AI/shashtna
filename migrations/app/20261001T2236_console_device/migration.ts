#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8530c58f4b7c554bcf7b8addd20794c3ed4e557b37395df103242d381bff2dec/contract';
import startContract from '../../snapshots/8530c58f4b7c554bcf7b8addd20794c3ed4e557b37395df103242d381bff2dec/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bec797f6cdd0f6176e108bccf699b545d84ccf8cdc029a2ee65af944c807ef51/contract';
import endContract from '../../snapshots/bec797f6cdd0f6176e108bccf699b545d84ccf8cdc029a2ee65af944c807ef51/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'consoleDevice',
        columns: [
          col('appVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('authenticatedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credentialHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('platform', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pushToken', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('revokedBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'loginThrottle',
        columns: [
          col('failures', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lockedUntil', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('windowStartedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'loginThrottle',
        constraint: 'loginThrottle_key_key',
        columns: ['key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'consoleDevice',
        index: 'consoleDevice_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'loginThrottle',
        index: 'loginThrottle_updatedAt_idx_8c508b31',
        columns: ['updatedAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
