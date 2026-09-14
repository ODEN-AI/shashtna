#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/43a06edb1b8d9f85e26da1d3cce6599debceb33d683b9313121c186ebad0f5b5/contract';
import startContract from '../../snapshots/43a06edb1b8d9f85e26da1d3cce6599debceb33d683b9313121c186ebad0f5b5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/4e51b906a518f515be3d6cf923300cc2ea1e0c5ed238c6a6403cdc524fcea623/contract';
import endContract from '../../snapshots/4e51b906a518f515be3d6cf923300cc2ea1e0c5ed238c6a6403cdc524fcea623/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropNotNull({ schema: 'public', table: 'user', column: 'email' }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_phone_key',
        columns: ['phone'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
