#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract';
import startContract from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/262d264c85b46a8babe105c9ffcb1e25df25303565c863c115dbbdcdb52e33f7/contract';
import endContract from '../../snapshots/262d264c85b46a8babe105c9ffcb1e25df25303565c863c115dbbdcdb52e33f7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'device',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('serviceType', 'text', {
            notNull: true,
            default: lit('IPTV'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('specifications', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'package',
        column: col('serviceType', 'text', {
          notNull: true,
          default: lit('IPTV'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'receipt',
        column: col('serviceType', 'text', {
          notNull: true,
          default: lit('IPTV'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('deviceId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('serviceType', 'text', {
          notNull: true,
          default: lit('IPTV'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('deviceId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('deviceName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('devicePrice', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('serviceType', 'text', {
          notNull: true,
          default: lit('IPTV'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.dropNotNull({ schema: 'public', table: 'subscription', column: 'password' }),
      this.dropNotNull({ schema: 'public', table: 'subscription', column: 'username' }),
      this.addUnique({
        schema: 'public',
        table: 'device',
        constraint: 'device_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'subscription',
        constraint: 'subscription_deviceId_key',
        columns: ['deviceId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
