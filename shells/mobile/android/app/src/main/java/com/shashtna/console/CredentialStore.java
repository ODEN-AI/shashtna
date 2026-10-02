package com.shashtna.console;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * The Phase 10A device credential, protected by the Android Keystore.
 *
 * An AES-256-GCM key is generated inside the Keystore (hardware-backed where
 * the device supports it) and never leaves it. Only the ciphertext (IV +
 * GCM output) is written to app-private preferences; the plaintext
 * credential exists only in memory while a request is being made, is never
 * logged and is never handed to the WebView or page JavaScript.
 *
 * The device id is not secret (it is useless without the credential); it is
 * kept so a later sign-in can re-bind the same device row.
 *
 * Biometric gating (setUserAuthenticationRequired) belongs to a later phase.
 */
final class CredentialStore {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "shashtna_console_device_credential_v1";
    private static final String PREFS = "shashtna_console_secure";
    private static final String FIELD_CREDENTIAL = "credential_gcm";
    private static final String FIELD_DEVICE_ID = "device_id";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SharedPreferences prefs;

    CredentialStore(Context context) {
        this.prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) entry).getSecretKey();

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    synchronized boolean save(String credential, int deviceId) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = cipher.getIV();
            byte[] sealed = cipher.doFinal(credential.getBytes(StandardCharsets.UTF_8));
            byte[] out = ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array();
            return prefs.edit()
                    .putString(FIELD_CREDENTIAL, Base64.encodeToString(out, Base64.NO_WRAP))
                    .putInt(FIELD_DEVICE_ID, deviceId)
                    .commit();
        } catch (Exception e) {
            return false;
        }
    }

    /** The credential, or null when absent or no longer decryptable (then it is cleared). */
    synchronized String load() {
        String stored = prefs.getString(FIELD_CREDENTIAL, null);
        if (stored == null) return null;
        try {
            byte[] all = Base64.decode(stored, Base64.NO_WRAP);
            if (all.length <= IV_BYTES) throw new IllegalStateException("short");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            byte[] plain = cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception e) {
            clearCredential();
            return null;
        }
    }

    synchronized boolean hasCredential() {
        return prefs.contains(FIELD_CREDENTIAL);
    }

    /** Device id for re-binding after a new sign-in, or null. */
    synchronized Integer deviceId() {
        return prefs.contains(FIELD_DEVICE_ID) ? prefs.getInt(FIELD_DEVICE_ID, 0) : null;
    }

    /** Forget the credential (signed out / rejected); keep the device id for re-binding. */
    synchronized void clearCredential() {
        prefs.edit().remove(FIELD_CREDENTIAL).commit();
    }

    /** Forget everything (device revoked on the server). */
    synchronized void clearAll() {
        prefs.edit().remove(FIELD_CREDENTIAL).remove(FIELD_DEVICE_ID).commit();
    }
}
