//! Secure credential storage. Wraps the OS credential store (Windows
//! Credential Manager on Windows, via the `keyring` crate) so the API key
//! never touches SQLite, JSON settings, or source — see docs/security.md.

use keyring::Entry;

const SERVICE_NAME: &str = "interview-copilot";

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
    // Real keyring round-trip tests require a real OS credential store
    // (Windows Credential Manager / macOS Keychain / libsecret), which is
    // not available in this container. See CLAUDE.md — validate on Windows.
}
