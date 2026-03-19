package com.vault.service;

import com.vault.dto.SecretResponseDTO;
import com.vault.model.ActivityLog;
import com.vault.model.Secret;
import com.vault.model.User;
import com.vault.repository.SecretRepository;
import com.vault.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class BurnService {

    private final SecretRepository secretRepository;
    private final UserRepository userRepository;
    private final EncryptionService encryptionService;
    private final EmailService emailService;
    private final ActivityService activityService;

    /**
     * Atomic burn-on-read: decrypts content, marks burned, saves, then triggers notifications.
     * The actual content is only returned ONCE — this call.
     */
    public SecretResponseDTO burnSecret(String secretId, String requesterUsername, String ipAddress) {
        Secret secret = secretRepository.findById(secretId)
                .orElseThrow(() -> new IllegalArgumentException("Secret not found"));

        if (secret.isBurned()) {
            throw new IllegalStateException("Secret has already been burned");
        }
        if (!secret.getRecipientUsername().equals(requesterUsername)) {
            throw new SecurityException("Access denied: you are not the recipient");
        }
        if (secret.getExpiresAt() != null && Instant.now().isAfter(secret.getExpiresAt())) {
            throw new IllegalStateException("Secret has expired");
        }

        // Decrypt content BEFORE marking burned
        String plaintext = encryptionService.decrypt(secret.getEncryptedContent(), secret.getIv());

        // Atomic burn
        secret.setBurned(true);
        secret.setBurnedAt(Instant.now());
        secret.setEncryptedContent(null); // Wipe encrypted content from record
        secret.setIv(null);
        secretRepository.save(secret);
        log.info("Secret {} burned by {}", secretId, requesterUsername);

        // Async: notify sender and log
        activityService.log(requesterUsername, secret.getSenderUsername(), secretId,
                ActivityLog.ActivityType.SECRET_BURNED, ipAddress);

        userRepository.findByUsername(secret.getSenderUsername()).ifPresent(sender -> {
            if (sender.isEmailNotificationsEnabled()) {
                emailService.sendSecretBurnedNotification(sender.getEmail(), sender.getUsername(), requesterUsername);
            }
        });

        SecretResponseDTO dto = toDto(secret);
        dto.setContent(plaintext);
        return dto;
    }

    public SecretResponseDTO toDto(Secret secret) {
        SecretResponseDTO dto = new SecretResponseDTO();
        dto.setId(secret.getId());
        dto.setSenderUsername(secret.getSenderUsername());
        dto.setRecipientUsername(secret.getRecipientUsername());
        dto.setSubject(secret.getSubject());
        dto.setBurned(secret.isBurned());
        dto.setCreatedAt(secret.getCreatedAt());
        dto.setBurnedAt(secret.getBurnedAt());
        dto.setExpiresAt(secret.getExpiresAt());
        dto.setExpiryHours(secret.getExpiryHours());
        return dto;
    }
}