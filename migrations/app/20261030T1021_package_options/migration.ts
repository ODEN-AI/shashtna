#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0c1c7155a55af79645b85de36570082b47d347a726673318e733c3762314c73d/contract';
import startContract from '../../snapshots/0c1c7155a55af79645b85de36570082b47d347a726673318e733c3762314c73d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5a6b23eee5347e68e94b5d569a78bb14ee28b04926c5b8a5ef0120a78b8dd733/contract';
import endContract from '../../snapshots/5a6b23eee5347e68e94b5d569a78bb14ee28b04926c5b8a5ef0120a78b8dd733/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

/**
 * Package options: one package, several lengths, each with its own price.
 * Additive: a new packageOption table and a nullable
 * subscriptionRequest.packageOptionId. Data: every existing package gets one
 * option copied from its current length, label, price and renewal price, so
 * the catalogue sells exactly what it sold before. Only packages without any
 * option are touched; packages, orders, receipts and subscriptions are not.
 */

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'packageOption',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('durationLabel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('durationMonths', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('durationUnit', 'text', {
            notNull: true,
            default: lit('MONTH'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('packageId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('renewalPrice', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('packageOptionId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'packageOption',
        constraint: 'packageOption_packageId_durationMonths_key',
        columns: ['packageId', 'durationMonths'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packageOption',
        index: 'packageOption_packageId_idx_51f866f4',
        columns: ['packageId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packageOption',
        foreignKey: {
          name: 'packageOption_packageId_fkey',
          columns: ['packageId'],
          references: { schema: 'public', table: 'package', columns: ['id'] },
        },
      }),
      rawSql({
        id: 'data.public.packageOption.backfill_from_package',
        label: 'Give every existing package one option with its current length and prices',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'packageOption' } },
        precheck: [],
        execute: [
          {
            description: 'packages without an option get one copied from their length, label, price and renewal price',
            sql: `INSERT INTO "public"."packageOption" ("packageId", "durationMonths", "durationUnit", "durationLabel", "price", "renewalPrice", "isActive", "createdAt", "updatedAt") SELECT p."id", p."durationMonths", p."durationUnit", p."durationLabel", p."price", p."renewalPrice", true, now(), now() FROM "public"."package" p WHERE NOT EXISTS (SELECT 1 FROM "public"."packageOption" o WHERE o."packageId" = p."id")`,
          },
        ],
        postcheck: [
          {
            description: 'every package has an option with its own length and price',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."package" p WHERE NOT EXISTS (SELECT 1 FROM "public"."packageOption" o WHERE o."packageId" = p."id" AND o."durationMonths" = p."durationMonths" AND o."price" = p."price")) AS "result"`,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
