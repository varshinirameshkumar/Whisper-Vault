package com.vault.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Slf4j
@Service
public class EncryptionService {

    private static final String ALGORITHM    = "AES/GCM/NoPadding";
    private static final int    GCM_IV_LEN   = 12;
    private static final int    GCM_TAG_BITS = 128;

    @Value("${whispervault.aesSecretKey}")
    private String aesSecretKey;

    /**
     * Derives a 32-byte AES key from the configured string using SHA-256.
     * This handles keys of any length safely.
     */
   
    private SecretKeySpec getSecretKey() {
        try {
            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(aesSecretKey.getBytes("UTF-8"));
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new RuntimeException("Failed to derive AES key", e);
        }
    }

    /**
     * Encrypts plaintext using AES-256-GCM.
     * @return String[0] = Base64 ciphertext, String[1] = Base64 IV
     */
    public String[] encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LEN];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, getSecretKey(),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes("UTF-8"));

            return new String[]{
                Base64.getEncoder().encodeToString(ciphertext),
                Base64.getEncoder().encodeToString(iv)
            };
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    
    public String decrypt(String base64Ciphertext, String base64Iv) {
        try {
            byte[] ciphertext = Base64.getDecoder().decode(base64Ciphertext);
            byte[] iv         = Base64.getDecoder().decode(base64Iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, getSecretKey(),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));

            return new String(cipher.doFinal(ciphertext), "UTF-8");
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}