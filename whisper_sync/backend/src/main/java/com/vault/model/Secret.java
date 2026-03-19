package com.vault.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "secrets")
public class Secret {
    @Id
    private String id = UUID.randomUUID().toString();

    private String senderUsername;
    private String recipientUsername;

    private String encryptedContent;
    private String iv; // AES initialization vector (base64)

    private boolean burned = false;
    private Instant createdAt = Instant.now();
    private Instant burnedAt;

    @Indexed(expireAfterSeconds = 0)
    private Instant expiresAt; // TTL index — MongoDB auto-deletes when this passes

    private int expiryHours = 24;
    private String subject;
}