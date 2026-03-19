package com.vault.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SecretResponseDTO {
    private String id;
    private String senderUsername;
    private String recipientUsername;
    private String subject;
    private String content; // Only populated on burn (reveal)
    private boolean burned;
    private Instant createdAt;
    private Instant burnedAt;
    private Instant expiresAt;
    private int expiryHours;
}