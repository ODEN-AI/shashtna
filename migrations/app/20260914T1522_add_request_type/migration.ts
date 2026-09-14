#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract';
import startContract from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ece0d6942565271720d40668fe3aa6185ef5d14c4e7451a633b040763820b5c4/contract';
import endContract from '../../snapshots/ece0d6942565271720d40668fe3aa6185ef5d14c4e7451a633b040763820b5c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropDefault({ schema: 'public', table: 'receipt', column: 'createdAt' }),
      this.createTable({
        schema: 'public',
        table: 'device',
        columns: [
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
      this.createTable({
        schema: 'public',
        table: 'packageDevice',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('packageId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
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
        column: col('requestType', 'text', {
          notNull: true,
          default: lit('NEW'),
          codecRef: { codecId: 'pg/text@1' },
        }),
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
      this.dropNotNull({ schema: 'public', table: 'user', column: 'email' }),
      this.addUnique({
        schema: 'public',
        table: 'device',
        constraint: 'device_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'packageDevice',
        constraint: 'packageDevice_packageId_deviceId_key',
        columns: ['packageId', 'deviceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'subscription',
        constraint: 'subscription_deviceId_key',
        columns: ['deviceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_phone_key',
        columns: ['phone'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packageDevice',
        index: 'packageDevice_deviceId_idx_a7d461e8',
        columns: ['deviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packageDevice',
        index: 'packageDevice_packageId_idx_51f866f4',
        columns: ['packageId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packageDevice',
        foreignKey: {
          name: 'packageDevice_packageId_fkey',
          columns: ['packageId'],
          references: { schema: 'public', table: 'package', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packageDevice',
        foreignKey: {
          name: 'packageDevice_deviceId_fkey',
          columns: ['deviceId'],
          references: { schema: 'public', table: 'device', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
