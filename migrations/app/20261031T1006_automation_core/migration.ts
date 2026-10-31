#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0102955a274660919ea2e2dcb51d26def14278de5b5ebeeb65280c2ad8497bec/contract';
import endContract from '../../snapshots/0102955a274660919ea2e2dcb51d26def14278de5b5ebeeb65280c2ad8497bec/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1b781f2d721029377d605ba88331d8ca0b899f43c80a19d4ff9ae53284f228ae/contract';
import startContract from '../../snapshots/1b781f2d721029377d605ba88331d8ca0b899f43c80a19d4ff9ae53284f228ae/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'automationRun',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('finishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('job', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('runKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('stats', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('RUNNING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('trigger', 'text', {
            notNull: true,
            default: lit('SCHEDULE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'outboxMessage',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('channel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dedupeKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nextAttemptAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('payload', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('sentBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('template', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'automationRun',
        constraint: 'automationRun_runKey_key',
        columns: ['runKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'outboxMessage',
        constraint: 'outboxMessage_dedupeKey_key',
        columns: ['dedupeKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automationRun',
        index: 'automationRun_job_idx_68c9b9cb',
        columns: ['job'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxMessage',
        index: 'outboxMessage_userId_idx_a489d58a',
        columns: ['userId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
