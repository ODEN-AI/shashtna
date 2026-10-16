#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/aa9d3f9a4366ee3df22bb8f6ec3778b49ac77ce4f3c48af3e3d48bd7a566b2bf/contract';
import endContract from '../../snapshots/aa9d3f9a4366ee3df22bb8f6ec3778b49ac77ce4f3c48af3e3d48bd7a566b2bf/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bec797f6cdd0f6176e108bccf699b545d84ccf8cdc029a2ee65af944c807ef51/contract';
import startContract from '../../snapshots/bec797f6cdd0f6176e108bccf699b545d84ccf8cdc029a2ee65af944c807ef51/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, rawSql } from '@prisma/orm-postgres/migration';

/**
 * Initial subscription packages (IQD). Insert-only and idempotent: a slug that
 * already exists is left exactly as it is (ON CONFLICT DO NOTHING), and no
 * existing package is changed or disabled. Prices, durations and status are
 * managed from Admin → Subscription Packages afterwards.
 */
const SEED_SLUGS = ['iptv-3m', 'iptv-6m', 'iptv-12m', 'iptv-24m'];

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'package',
        column: col('durationUnit', 'text', {
          notNull: true,
          default: lit('MONTH'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      rawSql({
        id: 'data.public.package.seed_initial_subscription_packages',
        label: 'Seed the initial IQD subscription packages (3, 6, 12, 24 months) when missing',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'package' } },
        precheck: [],
        execute: [
          {
            description: 'insert missing initial packages (existing slugs are not touched)',
            sql: `INSERT INTO "public"."package" ("name", "slug", "serviceType", "price", "durationMonths", "durationUnit", "durationLabel", "description", "specifications", "isActive", "updatedAt") VALUES
  ('IPTV 3 أشهر', 'iptv-3m', 'IPTV', 6000, 3, 'MONTH', '3 أشهر', 'اشتراك IPTV لمدة 3 أشهر', 'اشتراك لمدة 3 أشهر', true, now()),
  ('IPTV 6 أشهر', 'iptv-6m', 'IPTV', 10000, 6, 'MONTH', '6 أشهر', 'اشتراك IPTV لمدة 6 أشهر', 'اشتراك لمدة 6 أشهر', true, now()),
  ('IPTV 12 شهرًا', 'iptv-12m', 'IPTV', 15000, 12, 'YEAR', 'سنة واحدة', 'اشتراك IPTV لمدة سنة واحدة', 'اشتراك لمدة 12 شهرًا', true, now()),
  ('IPTV 24 شهرًا', 'iptv-24m', 'IPTV', 25000, 24, 'YEAR', 'سنتان', 'اشتراك IPTV لمدة سنتين', 'اشتراك لمدة 24 شهرًا', true, now())
ON CONFLICT ("slug") DO NOTHING`,
          },
        ],
        postcheck: [
          {
            description: 'verify every initial package slug exists',
            sql: 'SELECT (SELECT count(*) FROM "public"."package" WHERE "slug" = ANY($1::text[])) = 4 AS "result"',
            params: [SEED_SLUGS],
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
