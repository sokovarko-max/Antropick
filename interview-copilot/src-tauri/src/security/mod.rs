//! Secure credential storage. Wraps the OS credential store (Windows
//! Credential Manager on Windows, via the `keyring` crate) so the API key
//! never touches SQLite, JSON settings, or source — see docs/security.md.

use keyring::Entry;

const SERVICE_NAME: &str = "interview-copilot";

// keyring only links a real credential store when the matching platform
// feature is on; otherwise it resolves to `mock`, which lives in process
// memory. A mock store passes every round-trip check inside one run and loses
// the key at exit — the failure mode that made the API key look unsaveable
// and pinned the app in demo mode. On the platform this app actually ships
// to, refuse to build rather than ship that again.
#[cfg(all(target_os = "windows", not(feature = "secure-store-native")))]
compile_error!(
    "the `secure-store-native` feature is required on Windows: without it keyring \
     falls back to an in-memory store and the API key is lost on every restart"
);

/// Whether the credential store backing [`set`]/[`get`] outlives the process.
///
/// False where no native store is linked in — a Linux dev build here, which
/// has no libsecret. Keys are then held in memory only, and the UI has to say
/// so rather than report a key as saved and lose it.
pub fn is_persistent() -> bool {
    cfg!(all(
        feature = "secure-store-native",
        any(target_os = "windows", target_os = "macos", target_os = "ios")
    ))
}

#[derive(Debug, thiserror::Error)]
pub enum SecureStoreError {
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
}

pub fn set(key: &str, value: &str) -> Result<(), SecureStoreError> {
    let entry = Entry::new(SERVICE_NAME, key)?;
    entry.set_password(value)?;
    Ok(())
}

pub fn get(key: &str) -> Result<Option<String>, SecureStoreError> {
    let entry = Entry::new(SERVICE_NAME, key)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.into()),
    }
}

pub fn delete(key: &str) -> Result<(), SecureStoreError> {
    let entry = Entry::new(SERVICE_NAME, key)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Runs in Windows CI, where it is the assertion that matters: a build
    /// whose credential store does not outlive the process cannot hold an API
    /// key, and the app silently falls back to demo answers forever. The
    /// compile guard above should make this unreachable — this catches it if
    /// someone reaches Windows through a path that skips default features.
    #[test]
    #[cfg(target_os = "windows")]
    fn windows_builds_have_a_persistent_credential_store() {
        assert!(is_persistent());
    }

    /// The container has no libsecret, so this is the honest answer here — and
    /// the UI is expected to warn rather than claim a key was saved.
    #[test]
    #[cfg(target_os = "linux")]
    fn linux_dev_builds_report_a_non_persistent_store() {
        assert!(!is_persistent());
    }

    /// The behaviour `is_persistent` is promising, checked against the store
    /// that is actually linked in.
    ///
    /// The non-persistent branch is not a formality: keyring's mock store
    /// hands every `Entry::new` its own empty credential, so a value written
    /// through one entry is not visible to the next — `get` returns `None`
    /// immediately, not just after a restart. A Windows build without
    /// `secure-store-native` behaves exactly like this, which is why the API
    /// key could never be read back and the app stayed in demo mode forever.
    #[test]
    fn round_trip_matches_what_is_persistent_reports() {
        let key = format!("test-round-trip-{}", std::process::id());
        set(&key, "secret-value").expect("set");
        let read_back = get(&key).expect("get");

        if is_persistent() {
            assert_eq!(read_back, Some("secret-value".to_string()));
            delete(&key).expect("delete");
            assert_eq!(get(&key).expect("get after delete"), None);
        } else {
            assert_eq!(
                read_back, None,
                "the mock store is expected to lose the value; if it stopped \
                 doing so, is_persistent() is understating the store"
            );
        }
    }
}
