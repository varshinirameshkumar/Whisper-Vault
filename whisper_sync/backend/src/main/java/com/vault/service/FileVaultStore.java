package com.vault.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-memory ephemeral file store for group chat file/voice transfer.
 *
 * Files are stored ONLY in JVM heap — never written to disk or MongoDB.
 * Each entry auto-expires after 10 minutes.
 * Wiped completely when a room is burned (via wipeRoom).
 */
@Slf4j
@Component
public class FileVaultStore {

    public record FileEntry(
        byte[] encryptedBytes,   // AES-256-GCM encrypted file bytes (never decrypted server-side)
        String iv,               // Base64 IV — passed through to recipient
        String fileName,
        String mimeType,
        long   fileSize,         // original file size in bytes
        String roomId,
        String uploaderUsername,
        String messageType,      // "FILE" or "VOICE"
        Instant uploadedAt
    ) {}

    /** token -> FileEntry */
    private final ConcurrentHashMap<String, FileEntry> store = new ConcurrentHashMap<>();

    /** roomId -> list of tokens (for room-scoped wipe) */
    private final ConcurrentHashMap<String, java.util.Set<String>> roomTokens = new ConcurrentHashMap<>();

    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "file-vault-cleaner");
        t.setDaemon(true);
        return t;
    });

    public FileVaultStore() {
        // Sweep expired entries every 2 minutes
        cleaner.scheduleAtFixedRate(this::sweepExpired, 2, 2, TimeUnit.MINUTES);
    }

    /**
     * Store encrypted file bytes. Returns a short-lived access token.
     */
    public String store(byte[] encryptedBytes, String iv, String fileName,
                        String mimeType, long fileSize, String roomId,
                        String uploaderUsername, String messageType) {
        String token = UUID.randomUUID().toString();
        store.put(token, new FileEntry(
            encryptedBytes, iv, fileName, mimeType, fileSize,
            roomId, uploaderUsername, messageType, Instant.now()
        ));
        roomTokens.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(token);
        log.debug("FileVaultStore: stored {} bytes for room {} token {}", encryptedBytes.length, roomId, token);
        return token;
    }

    /**
     * Retrieve a file entry by token. Returns null if not found or expired.
     */
    public FileEntry get(String token) {
        FileEntry entry = store.get(token);
        if (entry == null) return null;
        // Expire after 10 minutes
        if (Instant.now().isAfter(entry.uploadedAt().plusSeconds(600))) {
            store.remove(token);
            return null;
        }
        return entry;
    }

    /**
     * Wipe all files associated with a room (called during Omni-Burn).
     */
    public void wipeRoom(String roomId) {
        java.util.Set<String> tokens = roomTokens.remove(roomId);
        if (tokens != null) {
            tokens.forEach(store::remove);
            log.info("FileVaultStore: wiped {} file(s) for room {}", tokens.size(), roomId);
        }
    }

    private void sweepExpired() {
        Instant cutoff = Instant.now().minusSeconds(600);
        store.entrySet().removeIf(e -> e.getValue().uploadedAt().isBefore(cutoff));
    }
}
