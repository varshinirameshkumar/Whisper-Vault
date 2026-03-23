package com.vault.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;

/**
 * Ephemeral chat message — STOMP payload only, never persisted.
 * Backend is a pure pass-through: receives encrypted payload, rebroadcasts as-is.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatMessage {

    public enum MessageType {
        TEXT,    // AES-256-GCM encrypted text
        FILE,    // AES-256-GCM encrypted file (Base64)
        VOICE,   // AES-256-GCM encrypted audio (Base64)
        PHOTO,   // AES-256-GCM encrypted photo from camera
        VIDEO,   // AES-256-GCM encrypted video from camera
        JOIN,    // system: user joined
        LEAVE,   // system: user left
        SYSTEM   // system: room event
    }

    private MessageType type = MessageType.TEXT;

    /** Sender username — set by backend after auth check */
    private String sender;

    /** AES-256-GCM encrypted payload (Base64). Backend never decrypts this. */
    private String encryptedPayload;

    /** AES IV (Base64) — generated client-side, passed through untouched */
    private String iv;

    /**
     * For FILE/VOICE messages sent via REST upload:
     * The short-lived token to fetch encrypted bytes from GET /api/files/{token}
     * encryptedPayload will be null for token-based transfers.
     */
    private String fileToken;

    // ─── File / Voice metadata (not encrypted — needed for UI rendering) ────
    private String fileName;
    private String mimeType;
    private Long   fileSize;

    private Instant timestamp = Instant.now();
    private String  roomId;
}
