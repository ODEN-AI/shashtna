#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0c1c7155a55af79645b85de36570082b47d347a726673318e733c3762314c73d/contract';
import endContract from '../../snapshots/0c1c7155a55af79645b85de36570082b47d347a726673318e733c3762314c73d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/aa9d3f9a4366ee3df22bb8f6ec3778b49ac77ce4f3c48af3e3d48bd7a566b2bf/contract';
import startContract from '../../snapshots/aa9d3f9a4366ee3df22bb8f6ec3778b49ac77ce4f3c48af3e3d48bd7a566b2bf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

/**
 * Renewal price per package (null = renewals cost the normal price).
 * Initial value: VIP renewals (3 months) cost 35,000 IQD. Only VIP 3-month
 * packages without a renewal price are touched; IPTV packages, VIP normal
 * prices and devices are not. Admins change it later from the dashboard.
 */

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'package',
        column: col('renewalPrice', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      rawSql({
        id: 'data.public.package.vip_renewal_price',
        label: 'Set the initial VIP renewal price (35,000 IQD, 3 months)',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'package' } },
        precheck: [],
        execute: [
          {
            description: 'VIP 3-month packages without a renewal price renew at 35,000 IQD',
            sql: `UPDATE "public"."package" SET "renewalPrice" = 35000, "updatedAt" = now() WHERE "serviceType" = 'VIP' AND "durationMonths" = 3 AND "renewalPrice" IS NULL`,
          },
        ],
        postcheck: [
          {
            description: 'no VIP 3-month package is left without a renewal price, and no IPTV package has one',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."package" WHERE ("serviceType" = 'VIP' AND "durationMonths" = 3 AND "renewalPrice" IS NULL) OR ("serviceType" = 'IPTV' AND "renewalPrice" IS NOT NULL)) AS "result"`,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
