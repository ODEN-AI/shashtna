#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4e51b906a518f515be3d6cf923300cc2ea1e0c5ed238c6a6403cdc524fcea623/contract';
import startContract from '../../snapshots/4e51b906a518f515be3d6cf923300cc2ea1e0c5ed238c6a6403cdc524fcea623/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ece0d6942565271720d40668fe3aa6185ef5d14c4e7451a633b040763820b5c4/contract';
import endContract from '../../snapshots/ece0d6942565271720d40668fe3aa6185ef5d14c4e7451a633b040763820b5c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'subscriptionRequest',
        column: col('requestType', 'text', {
          notNull: true,
          default: lit('NEW'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);