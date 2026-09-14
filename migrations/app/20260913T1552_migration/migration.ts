#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract';
import startContract from '../../snapshots/20c0f64af0af1d6d15daa14969c51b209786247528b96cf5f61d85296cb02128/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9af8669fc0278d2e07ad5b263fb70e724a81d3522245fe4dcc676e47ef509535/contract';
import endContract from '../../snapshots/9af8669fc0278d2e07ad5b263fb70e724a81d3522245fe4dcc676e47ef509535/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
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
        table: 'subscription',
        constraint: 'subscription_deviceId_key',
        columns: ['deviceId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
