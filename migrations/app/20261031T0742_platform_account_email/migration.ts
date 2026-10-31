#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1b781f2d721029377d605ba88331d8ca0b899f43c80a19d4ff9ae53284f228ae/contract';
import endContract from '../../snapshots/1b781f2d721029377d605ba88331d8ca0b899f43c80a19d4ff9ae53284f228ae/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2141783ee2a66a3d3426ff31c1a8059e1cd3093a1a16d8532598713f94e11c6a/contract';
import startContract from '../../snapshots/2141783ee2a66a3d3426ff31c1a8059e1cd3093a1a16d8532598713f94e11c6a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('accountEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
