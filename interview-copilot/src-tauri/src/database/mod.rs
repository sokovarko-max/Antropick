//! SQLite access. The frontend never opens the .db file directly — it goes
//! through the `db_execute` / `db_query` Tauri commands (see commands/mod.rs)
//! with parameterized statements only. Schema/migrations are authored in
//! TypeScript with Drizzle (`../drizzle.config.ts`) and generated into
//! `migrations/`; this module applies them at startup.

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, DbError> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Applies `migrations/*.sql` in lexical order, tracked in a
    /// `_migrations` table so re-runs are idempotent.
    pub fn migrate(&self) -> Result<(), DbError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at_ms INTEGER NOT NULL);",
        )?;

        // Migration SQL files are embedded at compile time from the
        // Drizzle-generated output so the binary doesn't depend on a
        // filesystem layout at runtime.
        const MIGRATIONS: &[(&str, &str)] = &[
            (
                "0000_ambitious_jackpot.sql",
                include_str!("../../migrations/0000_ambitious_jackpot.sql"),
            ),
            // Makes ai_responses.estimated_cost_usd nullable: null now means
            // "no price on file for the answering model" as distinct from a
            // genuinely free call.
            (
                "0001_gray_betty_brant.sql",
                include_str!("../../migrations/0001_gray_betty_brant.sql"),
            ),
        ];

        for (name, sql) in MIGRATIONS {
            let already_applied: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
                    [name],
                    |row| row.get::<_, i64>(0),
                )
                .map(|count| count > 0)?;
            if already_applied {
                continue;
            }
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO _migrations (name, applied_at_ms) VALUES (?1, ?2)",
                rusqlite::params![name, now_ms()],
            )?;
        }
        Ok(())
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock before epoch")
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Each test gets its own file: `migrate` is only idempotent within one
    /// database, and an in-memory connection would not survive the reopen the
    /// "runs twice" case needs.
    fn temp_db_path(name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("ic_migrate_{}_{}.db", name, now_ms()));
        path
    }

    #[test]
    fn migrations_apply_from_empty_and_are_idempotent() {
        let path = temp_db_path("idempotent");
        let db = Database::open(&path).expect("open");
        db.migrate().expect("first migrate");
        db.migrate().expect("second migrate");

        let applied: i64 = db
            .conn
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM _migrations", [], |row| row.get(0))
            .expect("count migrations");
        assert_eq!(applied, 2);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn cost_column_becomes_nullable_and_keeps_existing_rows() {
        // 0001 rebuilds ai_responses, so the risk it carries is losing rows or
        // the foreign key. Both are checked here rather than assumed.
        let path = temp_db_path("nullable_cost");
        let db = Database::open(&path).expect("open");
        db.migrate().expect("migrate");

        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO sessions (id, title, start_time_ms) VALUES ('s1', 't', 1)",
                [],
            )
            .expect("insert session");
            conn.execute(
                "INSERT INTO ai_responses (id, session_id, task_type, prompt, answer, created_at_ms, input_tokens, output_tokens, estimated_cost_usd) \
                 VALUES ('a1', 's1', 'REALTIME', 'p', 'a', 1, 10, 20, 0.5)",
                [],
            )
            .expect("insert priced response");

            // The point of the migration: an answer whose model has no price
            // on file records no cost at all, rather than a fabricated one.
            conn.execute(
                "INSERT INTO ai_responses (id, session_id, task_type, prompt, answer, created_at_ms, input_tokens, output_tokens, estimated_cost_usd) \
                 VALUES ('a2', 's1', 'REALTIME', 'p', 'a', 2, 10, 20, NULL)",
                [],
            )
            .expect("insert unpriced response");

            let priced: Option<f64> = conn
                .query_row(
                    "SELECT estimated_cost_usd FROM ai_responses WHERE id = 'a1'",
                    [],
                    |row| row.get(0),
                )
                .expect("read priced");
            assert_eq!(priced, Some(0.5));

            let unpriced: Option<f64> = conn
                .query_row(
                    "SELECT estimated_cost_usd FROM ai_responses WHERE id = 'a2'",
                    [],
                    |row| row.get(0),
                )
                .expect("read unpriced");
            assert_eq!(unpriced, None);

            // The rebuild must not have dropped the FK back to sessions.
            let orphan = conn.execute(
                "INSERT INTO ai_responses (id, session_id, task_type, prompt, answer, created_at_ms) \
                 VALUES ('a3', 'missing-session', 'REALTIME', 'p', 'a', 3)",
                [],
            );
            assert!(orphan.is_err(), "foreign key survived the table rebuild");
        }

        let _ = std::fs::remove_file(&path);
    }
}
