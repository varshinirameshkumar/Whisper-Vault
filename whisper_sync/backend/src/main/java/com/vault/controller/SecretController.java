package com.vault.controller;

import com.vault.dto.*;
import com.vault.model.ActivityLog;
import com.vault.model.Secret;
import com.vault.repository.SecretRepository;
import com.vault.repository.UserRepository;
import com.vault.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/secrets")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Secrets", description = "Send, receive, and burn ephemeral secrets")
public class SecretController {

    private final SecretRepository   secretRepository;
    private final UserRepository     userRepository;
    private final EncryptionService  encryptionService;
    private final EmailService       emailService;
    private final BurnService        burnService;
    private final ActivityService    activityService;

    @PostMapping
    @Operation(summary = "Send a new secret")
    public ResponseEntity<ApiResponse<SecretResponseDTO>> sendSecret(
            @Valid @RequestBody SecretRequestDTO request,
            Authentication auth,
            HttpServletRequest httpRequest) {

        if (!userRepository.existsByUsername(request.getRecipientUsername())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Recipient user not found"));
        }
        if (auth.getName().equals(request.getRecipientUsername())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Cannot send a secret to yourself"));
        }

        try {
            String[] encrypted = encryptionService.encrypt(request.getContent());

            Secret secret = new Secret();
            secret.setSenderUsername(auth.getName());
            secret.setRecipientUsername(request.getRecipientUsername());
            secret.setEncryptedContent(encrypted[0]);
            secret.setIv(encrypted[1]);
            secret.setSubject(request.getSubject());
            secret.setExpiryHours(request.getExpiryHours());
            secret.setExpiresAt(Instant.now().plusSeconds((long) request.getExpiryHours() * 3600));
            secretRepository.save(secret);

            try {
                activityService.log(auth.getName(), request.getRecipientUsername(),
                        secret.getId(), ActivityLog.ActivityType.SECRET_SENT,
                        httpRequest.getRemoteAddr());
            } catch (Exception e) {
                log.warn("Activity log failed (non-fatal): {}", e.getMessage());
            }

            try {
                userRepository.findByUsername(request.getRecipientUsername()).ifPresent(recipient -> {
                    if (recipient.isEmailNotificationsEnabled()) {
                        emailService.sendNewSecretNotification(
                                recipient.getEmail(), recipient.getUsername(), auth.getName());
                    }
                });
            } catch (Exception e) {
                log.warn("Email notification failed (non-fatal): {}", e.getMessage());
            }

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok("Secret sent successfully", burnService.toDto(secret)));

        } catch (Exception e) {
            log.error("Failed to send secret: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to send secret: " + e.getMessage()));
        }
    }

    @GetMapping("/inbox")
    @Operation(summary = "Get unread secrets in inbox")
    public ResponseEntity<ApiResponse<List<SecretResponseDTO>>> getInbox(Authentication auth) {
        try {
            List<SecretResponseDTO> inbox = secretRepository
                    .findByRecipientUsernameAndBurnedFalseOrderByCreatedAtDesc(auth.getName())
                    .stream()
                    .map(burnService::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ApiResponse.ok(inbox));
        } catch (Exception e) {
            log.error("Inbox load failed for {}: {}", auth.getName(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to load inbox: " + e.getMessage()));
        }
    }

    @GetMapping("/sent")
    @Operation(summary = "Get sent secrets")
    public ResponseEntity<ApiResponse<List<SecretResponseDTO>>> getSent(Authentication auth) {
        try {
            List<SecretResponseDTO> sent = secretRepository
                    .findBySenderUsernameOrderByCreatedAtDesc(auth.getName())
                    .stream()
                    .map(burnService::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ApiResponse.ok(sent));
        } catch (Exception e) {
            log.error("Sent load failed for {}: {}", auth.getName(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to load sent: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/burn")
    @Operation(summary = "Burn a secret — one-time atomic operation")
    public ResponseEntity<ApiResponse<SecretResponseDTO>> burnSecret(
            @PathVariable String id,
            Authentication auth,
            HttpServletRequest httpRequest) {
        try {
            SecretResponseDTO burned = burnService.burnSecret(id, auth.getName(), httpRequest.getRemoteAddr());
            return ResponseEntity.ok(ApiResponse.ok("Secret revealed and destroyed", burned));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.GONE).body(ApiResponse.error(e.getMessage()));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/stats")
    @Operation(summary = "Get inbox unread count")
    public ResponseEntity<ApiResponse<Object>> getStats(Authentication auth) {
        try {
            long unread = secretRepository.countByRecipientUsernameAndBurnedFalse(auth.getName());
            return ResponseEntity.ok(ApiResponse.ok(Map.of("unreadCount", unread)));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.ok(Map.of("unreadCount", 0)));
        }
    }
}