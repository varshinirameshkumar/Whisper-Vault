package com.vault.service;

import com.vault.model.ActivityLog;
import com.vault.model.GroupRoom;
import com.vault.repository.GroupRoomRepository;
import com.vault.service.FileVaultStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.Duration;

/**
 * Vaijayanthi's Omni-Burn Service.
 * Hard-wipes all in-memory state and marks the MongoDB room document as BURNED.
 * Chat content is NEVER in MongoDB so no content purge is needed there.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WipeRoomService {

    private final RoomStore               roomStore;
    private final FileVaultStore          fileVaultStore;
    private final GroupRoomRepository     groupRoomRepository;
    private final ActivityService         activityService;
    private final SimpMessagingTemplate   messagingTemplate;

    /**
     * Execute Omni-Burn for a room whose subscriber count has dropped to zero.
     */
    public void wipeRoom(String roomId, Instant sessionStarted) {
        log.info("Omni-Burn initiated for room {}", roomId);

        // 1. Flush in-memory buffer (messages + subscriber state)
        roomStore.wipeRoom(roomId);

        // 2. Wipe any in-memory file/voice uploads for this room
        fileVaultStore.wipeRoom(roomId);

        // 2. Mark MongoDB room document as BURNED (only metadata — no chat content was there)
        groupRoomRepository.findById(roomId).ifPresent(room -> {
            room.setStatus(GroupRoom.RoomStatus.BURNED);
            groupRoomRepository.save(room);
        });

        // 3. Audit log — Vaijayanthi's final audit
        long durationSeconds = sessionStarted != null
            ? Duration.between(sessionStarted, Instant.now()).getSeconds()
            : 0;
        String durationStr = formatDuration(durationSeconds);

        log.info("SESSION AUDIT — Session [{}] ended at [{}]. Duration: {}. Content Purged: YES",
            roomId, Instant.now(), durationStr);

        try {
            activityService.log(
                "SYSTEM", "ROOM:" + roomId, roomId,
                ActivityLog.ActivityType.ROOM_BURNED, "internal"
            );
        } catch (Exception e) {
            log.warn("Audit log failed (non-fatal): {}", e.getMessage());
        }

        // 4. Broadcast final wipe event to any lingering subscribers
        try {
            messagingTemplate.convertAndSend(
                "/topic/chat/" + roomId,
                java.util.Map.of(
                    "type", "ROOM_BURNED",
                    "roomId", roomId,
                    "message", "Session ended. All content has been permanently purged.",
                    "duration", durationStr
                )
            );
        } catch (Exception e) {
            log.debug("Could not broadcast burn event (room already empty): {}", e.getMessage());
        }
    }

    private String formatDuration(long seconds) {
        if (seconds < 60) return seconds + "s";
        if (seconds < 3600) return (seconds / 60) + "m " + (seconds % 60) + "s";
        return (seconds / 3600) + "h " + ((seconds % 3600) / 60) + "m";
    }
}
