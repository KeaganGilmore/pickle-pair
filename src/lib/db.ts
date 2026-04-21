import Dexie, { type Table } from 'dexie';
import type { Tournament, Player, Match, AuditLog, PendingMutation } from './types';

export class PickleDB extends Dexie {
  tournaments!: Table<Tournament, string>;
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  audit!: Table<AuditLog, string>;
  pending!: Table<PendingMutation, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('picklepair');
    this.version(1).stores({
      tournaments: 'id, token, edit_token, updated_at, status',
      players: 'id, tournament_id, withdrawn, name',
      matches: 'id, tournament_id, round, status, [tournament_id+round]',
      audit: 'id, tournament_id, created_at',
      pending: 'id, tournament_id, entity, created_at',
      meta: 'key',
    });
  }
}

export const db = new PickleDB();
