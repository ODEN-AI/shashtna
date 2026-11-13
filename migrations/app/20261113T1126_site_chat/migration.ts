#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/aecfefce425c7089070c55e65decc0396065142c508f780f6c6e7fa6c785619f/contract';
import endContract from '../../snapshots/aecfefce425c7089070c55e65decc0396065142c508f780f6c6e7fa6c785619f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e5c01d610ff75d1b39be58e62185b2cd18c8ac65d953ae1773ea2c58645451ab/contract';
import startContract from '../../snapshots/e5c01d610ff75d1b39be58e62185b2cd18c8ac65d953ae1773ea2c58645451ab/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'chatConversation',
        columns: [
          col('closedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('handedOverAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('handoverNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('handoverReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastSender', 'text', {
            notNull: true,
            default: lit('CUSTOMER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('AI'),
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
      this.createTable({
        schema: 'public',
        table: 'chatMessage',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('conversationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sender', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('staffId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatConversation',
        index: 'chatConversation_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatConversation',
        index: 'chatConversation_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessage',
        index: 'chatMessage_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
