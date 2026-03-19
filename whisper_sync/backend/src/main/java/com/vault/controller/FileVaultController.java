package com.vault.controller;

import com.vault.dto.ApiResponse;
import com.vault.model.GroupRoom;
import com.vault.service.FileVaultStore;
import com.vault.service.GroupRoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

/**
 * REST endpoint for encrypted file/voice upload and download.
 *
 * WHY REST instead of WebSocket:
 * SockJS has per-frame streaming limits that disconnect the session
 * when large payloads are sent over WebSocket. HTTP multipart handles
 * large files reliably.
 *
 * Flow:
 * 1. Sender encrypts file client-side (AES-256-GCM) → uploads via POST /api/files/upload/{roomId}
 * 2. Backend stores encrypted bytes in memory → returns a short-lived token
 * 3. Sender sends {type:"FILE", fileToken, fileName, mimeType, fileSize, iv} over WebSocket (small payload)
 * 4. Recipient receives WebSocket message → fetches file via GET /api/files/{token}
 * 5. Recipient decrypts client-side using the iv from the WebSocket message
 *
 * Backend NEVER decrypts — pure pass-through.
 */
@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "File Vault", description = "Ephemeral encrypted file transfer for group chat")
public class FileVaultController {

    private final FileVaultStore   fileVaultStore;
    private final GroupRoomService groupRoomService;

    private static final long MAX_BYTES = 8L * 1024 * 1024; // 8 MB

    // ─── Upload ───────────────────────────────────────────────────────────────

    @PostMapping("/upload/{roomId}")
    @Operation(summary = "Upload an AES-256-GCM encrypted file. Returns a short-lived token.")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @PathVariable String roomId,
            @RequestParam("file")        MultipartFile file,
            @RequestParam("iv")          String iv,
            @RequestParam("fileName")    String fileName,
            @RequestParam("mimeType")    String mimeType,
            @RequestParam("fileSize")    long fileSize,
            @RequestParam("messageType") String messageType,
            Authentication auth) {

        // Validate room membership
        GroupRoom room = groupRoomService.findById(roomId).orElse(null);
        if (room == null || room.getStatus() == GroupRoom.RoomStatus.BURNED) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Room not found or burned"));
        }
        if (!room.getAcceptedUsernames().contains(auth.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Not a room participant"));
        }

        // Size guard
        if (file.getSize() > MAX_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiResponse.error("File exceeds 8 MB limit"));
        }

        try {
            byte[] encryptedBytes = file.getBytes();
            String token = fileVaultStore.store(
                encryptedBytes, iv, fileName, mimeType, fileSize,
                roomId, auth.getName(), messageType.toUpperCase()
            );

            log.info("FileVault: {} uploaded {} bytes for room {} token {}",
                auth.getName(), encryptedBytes.length, roomId, token);

            Map<String, Object> result = new HashMap<>();
            result.put("token", token);
            result.put("fileName", fileName);
            result.put("mimeType", mimeType);
            result.put("fileSize", fileSize);

            return ResponseEntity.ok(ApiResponse.ok("File stored", result));
        } catch (Exception e) {
            log.error("FileVault upload failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Upload failed: " + e.getMessage()));
        }
    }

    // ─── Download ─────────────────────────────────────────────────────────────

    @GetMapping("/{token}")
    @Operation(summary = "Download encrypted file bytes by token. Caller decrypts client-side.")
    public ResponseEntity<byte[]> download(
            @PathVariable String token,
            Authentication auth) {

        FileVaultStore.FileEntry entry = fileVaultStore.get(token);
        if (entry == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        // Validate requester is in the same room
        GroupRoom room = groupRoomService.findById(entry.roomId()).orElse(null);
        if (room == null || (!room.getAcceptedUsernames().contains(auth.getName())
                          && !room.getSpectators().contains(auth.getName()))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        log.debug("FileVault: {} downloading token {} ({} bytes)", auth.getName(), token, entry.encryptedBytes().length);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + entry.fileName().replaceAll("[^a-zA-Z0-9._-]", "_") + "\"")
            .header("X-File-IV",       entry.iv())
            .header("X-File-Name",     entry.fileName())
            .header("X-File-MimeType", entry.mimeType())
            .header("X-File-Size",     String.valueOf(entry.fileSize()))
            .header("X-Message-Type",  entry.messageType())
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(entry.encryptedBytes());
    }
}
