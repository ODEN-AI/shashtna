//! The Phase 10A device credential in the Windows Credential Manager.
//!
//! Stored as a generic credential of the signed-in Windows user (protected by
//! DPAPI, never in a file the app writes, never roamed by the app). The
//! plaintext exists only in memory for the exchange request. The device id is
//! not secret (useless without the credential) and is kept so a later sign-in
//! re-binds the same device row.

use shashtna_console_core::session::CredentialStore;

pub const SERVICE: &str = "com.shashtna.console";
const CREDENTIAL_ACCOUNT: &str = "device-credential";
const DEVICE_ACCOUNT: &str = "device-id";

#[cfg(windows)]
mod imp {
    use keyring::Entry;

    pub fn get(account: &str) -> Option<String> {
        Entry::new(super::SERVICE, account).ok()?.get_password().ok()
    }

    pub fn set(account: &str, value: &str) -> bool {
        Entry::new(super::SERVICE, account).and_then(|e| e.set_password(value)).is_ok()
    }

    pub fn delete(account: &str) {
        if let Ok(entry) = Entry::new(super::SERVICE, account) {
            let _ = entry.delete_credential();
        }
    }
}

// The shell targets Windows only. Elsewhere (local `cargo check`) nothing is
// persisted, so no credential can end up in an unprotected place.
#[cfg(not(windows))]
mod imp {
    pub fn get(_account: &str) -> Option<String> {
        None
    }
    pub fn set(_account: &str, _value: &str) -> bool {
        false
    }
    pub fn delete(_account: &str) {}
}

pub struct WindowsCredentialStore;

impl CredentialStore for WindowsCredentialStore {
    fn load(&self) -> Option<String> {
        let value = imp::get(CREDENTIAL_ACCOUNT)?;
        if value.starts_with("scd1.") {
            Some(value)
        } else {
            imp::delete(CREDENTIAL_ACCOUNT);
            None
        }
    }

    fn save(&self, credential: &str, device_id: i64) -> bool {
        imp::set(CREDENTIAL_ACCOUNT, credential) && imp::set(DEVICE_ACCOUNT, &device_id.to_string())
    }

    fn has_credential(&self) -> bool {
        imp::get(CREDENTIAL_ACCOUNT).is_some()
    }

    fn device_id(&self) -> Option<i64> {
        imp::get(DEVICE_ACCOUNT)?.parse().ok()
    }

    fn clear_credential(&self) {
        imp::delete(CREDENTIAL_ACCOUNT);
    }

    fn clear_all(&self) {
        imp::delete(CREDENTIAL_ACCOUNT);
        imp::delete(DEVICE_ACCOUNT);
    }
}
