#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/aa9d3f9a4366ee3df22bb8f6ec3778b49ac77ce4f3c48af3e3d48bd7a566b2bf/contract';
import endContract from '../../snapshots/aa9d3f9a4366ee3df22bb8f6ec3778b49ac77ce4f3c48af3e3d48bd7a566b2bf/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bec797f6cdd0f6176e108bccf699b545d84ccf8cdc029a2ee65af944c807ef51/contract';
import startContract from '../../snapshots/bec797f6cdd0f6176e108bccf699b545d84ccf8cdc029a2ee65af944c807ef51/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, rawSql } from '@prisma/orm-postgres/migration';

/**
 * Canonical IPTV packages (IQD): 3 months 6,000 · 6 months 10,000 ·
 * 12 months 15,000 · 24 months 25,000. IPTV only — every statement is limited
 * to "serviceType" = 'IPTV', so VIP packages, devices and VIP renewals are
 * never read or changed here.
 *
 * - 12 / 24 months reuse the existing iptv-1y / iptv-2y rows (same slug, name,
 *   image, links and history); only their price and duration unit change, and
 *   only when the row really is a 12 / 24-month IPTV package.
 * - A package is inserted only when no active IPTV package of that duration
 *   exists (no duplicate durations) and its slug is free (ON CONFLICT DO NOTHING),
 *   so databases without the legacy slugs still get all four.
 * - Nothing is deleted or disabled. Orders, receipts and subscriptions keep
 *   the price and duration recorded when they were bought.
 * Fallback rows use their own names (not "IPTV سنة"), since older
 * subscriptions are matched to packages by name.
 * Re-running it changes nothing.
 */
const IPTV_PACKAGES_SQL = `INSERT INTO "public"."package" ("name", "slug", "serviceType", "price", "durationMonths", "durationUnit", "durationLabel", "description", "specifications", "isActive", "updatedAt")
SELECT v.name, v.slug, 'IPTV', v.price, v.months, v.unit, v.label, v.description, v.specifications, true, now()
FROM (VALUES
  ('IPTV 3 أشهر', 'iptv-3m', 6000, 3, 'MONTH', '3 أشهر', 'اشتراك IPTV لمدة 3 أشهر', 'اشتراك لمدة 3 أشهر'),
  ('IPTV 6 أشهر', 'iptv-6m', 10000, 6, 'MONTH', '6 أشهر', 'اشتراك IPTV لمدة 6 أشهر', 'اشتراك لمدة 6 أشهر'),
  ('IPTV 12 شهرًا', 'iptv-12m', 15000, 12, 'YEAR', 'سنة واحدة', 'اشتراك IPTV لمدة سنة واحدة', 'اشتراك لمدة 12 شهرًا'),
  ('IPTV 24 شهرًا', 'iptv-24m', 25000, 24, 'YEAR', 'سنتان', 'اشتراك IPTV لمدة سنتين', 'اشتراك لمدة 24 شهرًا')
) AS v(name, slug, price, months, unit, label, description, specifications)
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."package" p
  WHERE p."serviceType" = 'IPTV' AND p."durationMonths" = v.months AND p."isActive"
)
ON CONFLICT ("slug") DO NOTHING`;

function repriceLegacy(slug: string, months: number, price: number) {
  return {
    description: `reprice legacy IPTV package ${slug} (${months} months) to ${price} IQD`,
    sql: `UPDATE "public"."package" SET "price" = ${price}, "durationUnit" = 'YEAR', "updatedAt" = now() WHERE "slug" = '${slug}' AND "serviceType" = 'IPTV' AND "durationMonths" = ${months} AND ("price" <> ${price} OR "durationUnit" <> 'YEAR')`,
  };
}

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
        id: 'data.public.package.canonical_iptv_packages',
        label: 'Canonical IPTV packages: reprice iptv-1y / iptv-2y, add missing 3 / 6 / 12 / 24-month IPTV packages',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'package' } },
        precheck: [],
        execute: [
          repriceLegacy('iptv-1y', 12, 15000),
          repriceLegacy('iptv-2y', 24, 25000),
          {
            description: 'insert IPTV packages for durations that have no active IPTV package',
            sql: IPTV_PACKAGES_SQL,
          },
        ],
        postcheck: [
          {
            description: 'every canonical IPTV duration exists and the legacy rows carry the new prices',
            sql: `SELECT (SELECT count(DISTINCT "durationMonths") FROM "public"."package" WHERE "serviceType" = 'IPTV' AND "durationMonths" IN (3, 6, 12, 24)) = 4
  AND NOT EXISTS (SELECT 1 FROM "public"."package" WHERE "serviceType" = 'IPTV' AND (("slug" = 'iptv-1y' AND "durationMonths" = 12 AND "price" <> 15000) OR ("slug" = 'iptv-2y' AND "durationMonths" = 24 AND "price" <> 25000))) AS "result"`,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
