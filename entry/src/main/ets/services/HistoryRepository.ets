import { relationalStore } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { PatternCatalog } from '../core/BreathPattern';
import { SessionRecord } from '../core/SessionRecord';
import { SessionStatus, parseEmotion, parseMode } from '../core/SessionTypes';

const DB_NAME = 'sedona_history.db';
const TABLE = 'sessions';
/** Older rows are pruned so the history never grows unbounded on the watch. */
const MAX_ROWS = 500;

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS ${TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  planned_min INTEGER NOT NULL,
  mode TEXT NOT NULL,
  pattern TEXT NOT NULL,
  cycles INTEGER NOT NULL,
  status TEXT NOT NULL,
  stopped_at TEXT NOT NULL DEFAULT '',
  emotion TEXT NOT NULL DEFAULT '',
  intensity_before INTEGER NOT NULL DEFAULT -1,
  intensity_after INTEGER NOT NULL DEFAULT -1,
  rounds INTEGER NOT NULL DEFAULT 1,
  heart_rate INTEGER NOT NULL DEFAULT 0)`;

const COLUMNS = 'id, started_at, ended_at, duration_sec, planned_min, mode, pattern, cycles, status, stopped_at, ' +
  'emotion, intensity_before, intensity_after, rounds, heart_rate';

/**
 * Session history in RelationalStore (SQLite):
 *  - ordered queries ("last 10", "count today", "last completed") without
 *    loading and parsing the whole history;
 *  - atomic inserts, so a crash never corrupts previously saved sessions;
 *  - a single DELETE for "delete all history".
 * Stored only in the app sandbox on the watch (security level S1), never synced.
 */
export class HistoryRepository {
  static readonly INSTANCE: HistoryRepository = new HistoryRepository();

  private store: relationalStore.RdbStore | undefined = undefined;
  private dbName: string = DB_NAME;

  /** `dbName` is overridden only by instrumented tests. */
  async init(context: common.Context, dbName: string = DB_NAME): Promise<void> {
    if (this.store !== undefined && this.dbName === dbName) {
      return;
    }
    this.dbName = dbName;
    const config: relationalStore.StoreConfig = {
      name: dbName,
      securityLevel: relationalStore.SecurityLevel.S1
    };
    const store = await relationalStore.getRdbStore(context, config);
    await store.executeSql(CREATE_SQL);
    await store.executeSql(`CREATE INDEX IF NOT EXISTS idx_started ON ${TABLE}(started_at)`);
    this.store = store;
  }

  async insert(r: SessionRecord): Promise<number> {
    const store = this.db();
    const values: relationalStore.ValuesBucket = {
      'started_at': r.startedAt,
      'ended_at': r.endedAt,
      'duration_sec': r.durationSec,
      'planned_min': r.plannedMin,
      'mode': r.mode,
      'pattern': r.patternId,
      'cycles': r.cycles,
      'status': r.status,
      'stopped_at': r.stoppedAt,
      'emotion': r.emotionBefore,
      'intensity_before': r.intensityBefore,
      'intensity_after': r.intensityAfter,
      'rounds': r.rounds,
      'heart_rate': r.heartRateAvg
    };
    const id = await store.insert(TABLE, values);
    await store.executeSql(
      `DELETE FROM ${TABLE} WHERE id NOT IN (SELECT id FROM ${TABLE} ORDER BY started_at DESC LIMIT ${MAX_ROWS})`);
    return id;
  }

  async latest(limit: number = 10): Promise<SessionRecord[]> {
    return this.query(`SELECT ${COLUMNS} FROM ${TABLE} ORDER BY started_at DESC LIMIT ?`, [limit]);
  }

  async lastCompleted(): Promise<SessionRecord | undefined> {
    const rows = await this.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE status = ? ORDER BY ended_at DESC LIMIT 1`,
      [SessionStatus.COMPLETED]);
    return rows.length > 0 ? rows[0] : undefined;
  }

  /** Number of sessions (completed or interrupted) that started since `sinceMs`. */
  async countSince(sinceMs: number): Promise<number> {
    const rs = await this.db().querySql(`SELECT COUNT(*) FROM ${TABLE} WHERE started_at >= ?`, [sinceMs]);
    let n = 0;
    if (rs.goToFirstRow()) {
      n = rs.getLong(0);
    }
    rs.close();
    return n;
  }

  async count(): Promise<number> {
    return this.countSince(0);
  }

  async deleteAll(): Promise<void> {
    await this.db().executeSql(`DELETE FROM ${TABLE}`);
  }

  private async query(sql: string, args: relationalStore.ValueType[]): Promise<SessionRecord[]> {
    const rs = await this.db().querySql(sql, args);
    const out: SessionRecord[] = [];
    while (rs.goToNextRow()) {
      const r = new SessionRecord();
      r.id = rs.getLong(0);
      r.startedAt = rs.getLong(1);
      r.endedAt = rs.getLong(2);
      r.durationSec = rs.getLong(3);
      r.plannedMin = rs.getLong(4);
      r.mode = parseMode(rs.getString(5));
      r.patternId = PatternCatalog.parseId(rs.getString(6));
      r.cycles = rs.getLong(7);
      r.status = rs.getString(8) === SessionStatus.INTERRUPTED ? SessionStatus.INTERRUPTED : SessionStatus.COMPLETED;
      r.stoppedAt = rs.getString(9);
      r.emotionBefore = parseEmotion(rs.getString(10));
      r.intensityBefore = rs.getLong(11);
      r.intensityAfter = rs.getLong(12);
      r.rounds = rs.getLong(13);
      r.heartRateAvg = rs.getLong(14);
      out.push(r);
    }
    rs.close();
    return out;
  }

  private db(): relationalStore.RdbStore {
    if (this.store === undefined) {
      throw new Error('HistoryRepository is not initialized');
    }
    return this.store;
  }
}

/** Local midnight for "practices today". */
export function startOfToday(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
