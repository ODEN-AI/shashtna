#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2141783ee2a66a3d3426ff31c1a8059e1cd3093a1a16d8532598713f94e11c6a/contract';
import endContract from '../../snapshots/2141783ee2a66a3d3426ff31c1a8059e1cd3093a1a16d8532598713f94e11c6a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eb9bf30b7888769924bb5c75d3d0a0c9367da8fdf1aa10e55fabdee317351cda/contract';
import startContract from '../../snapshots/eb9bf30b7888769924bb5c75d3d0a0c9367da8fdf1aa10e55fabdee317351cda/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

/**
 * Plan groups: packages shown on /plans in groups (IPTV, VIP and the digital
 * platforms the owner adds). Additive: a packageGroup table, package.groupId,
 * packageOption.costIqd and the delivery fields on subscriptionRequest.
 * Data: the two built-in groups (IPTV, VIP) are created when missing, and only
 * packages WITHOUT a group are placed in the group of their own service type.
 * Safe to run again; no other row is touched.
 */

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'packageGroup',
        columns: [
          col('accent', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('delivery', 'text', {
            notNull: true,
            default: lit('ACCOUNT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('descriptionEn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('logoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nameEn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('serviceType', 'text', {
            notNull: true,
            default: lit('DIGITAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('surface', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        column: col('groupId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'packageOption',
        column: col('costIqd', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('deliveryCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('deliveryEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'packageGroup',
        constraint: 'packageGroup_slug_key',
        columns: ['slug'],
      }),
      rawSql({
        id: 'data.public.packageGroup.builtin_iptv_vip',
        label: 'Create the built-in IPTV and VIP groups and place ungrouped IPTV / VIP packages in them',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'packageGroup' } },
        precheck: [],
        execute: [
          {
            description: 'the built-in groups exist (kept as they are when already there)',
            sql: `INSERT INTO "public"."packageGroup" ("name", "nameEn", "slug", "sortOrder", "isActive", "accent", "surface", "delivery", "serviceType", "createdAt", "updatedAt") VALUES ('باقات IPTV', 'IPTV plans', 'iptv', 0, true, '#3d6bff', '#0b1738', 'ACCOUNT', 'IPTV', now(), now()), ('باقات VIP', 'VIP plans', 'vip', 1, true, '#f1cf7a', '#0b1738', 'ACCOUNT', 'VIP', now(), now()) ON CONFLICT ("slug") DO NOTHING`,
          },
          {
            description: 'only packages without a group join the group of their service type',
            sql: `UPDATE "public"."package" p SET "groupId" = g."id" FROM "public"."packageGroup" g WHERE p."groupId" IS NULL AND g."slug" = lower(p."serviceType") AND upper(p."serviceType") IN ('IPTV', 'VIP')`,
          },
        ],
        postcheck: [
          {
            description: 'no IPTV or VIP package is left without a group',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."package" p WHERE p."groupId" IS NULL AND upper(p."serviceType") IN ('IPTV', 'VIP')) AS "result"`,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
