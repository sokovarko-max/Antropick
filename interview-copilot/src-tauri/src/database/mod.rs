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
        const MIGRATIONS: &[(&str, &str)] = &[(
            "0000_ambitious_jackpot.sql",
            include_str!("../../migrations/0000_ambitious_jackpot.sql"),
        )];

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
