#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/43a06edb1b8d9f85e26da1d3cce6599debceb33d683b9313121c186ebad0f5b5/contract';
import endContract from '../../snapshots/43a06edb1b8d9f85e26da1d3cce6599debceb33d683b9313121c186ebad0f5b5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9af8669fc0278d2e07ad5b263fb70e724a81d3522245fe4dcc676e47ef509535/contract';
import startContract from '../../snapshots/9af8669fc0278d2e07ad5b263fb70e724a81d3522245fe4dcc676e47ef509535/contract.json' with { type: 'json' };
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
