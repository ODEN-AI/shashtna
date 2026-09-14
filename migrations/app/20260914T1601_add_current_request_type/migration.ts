#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1b8422414561e16bebdffafd727686bdaedebfbc48f102cc66aefca411806ace/contract';
import endContract from '../../snapshots/1b8422414561e16bebdffafd727686bdaedebfbc48f102cc66aefca411806ace/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ece0d6942565271720d40668fe3aa6185ef5d14c4e7451a633b040763820b5c4/contract';
import startContract from '../../snapshots/ece0d6942565271720d40668fe3aa6185ef5d14c4e7451a633b040763820b5c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        schema: 'public',
        table: 'receipt',
        column: 'createdAt',
        defaultSql: 'DEFAULT (now())',
      }),
      this.setDefault({
        schema: 'public',
        table: 'subscriptionRequest',
        column: 'updatedAt',
        defaultSql: 'DEFAULT (now())',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
