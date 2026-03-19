package com.vault.controller;

import com.vault.model.ChatMessage;
import com.vault.model.GroupRoom;
import com.vault.service.GroupRoomService;
import com.vault.service.RoomStore;
import com.vault.service.WipeRoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * STOMP WebSocket controller for ephemeral group chat rooms.
 *
 * Publishes to /topic/chat/{roomId}
 * Listens at /app/chat/{roomId}
 *
 * File messages are pure pass-through — backend never decrypts or stores file bytes.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final GroupRoomService      groupRoomService;
    private final RoomStore             roomStore;
    private final WipeRoomService       wipeRoomService;

    /** sessionId -> roomId (for tracking disconnects) */
    private final ConcurrentHashMap<String, String>  sessionRoomMap    = new ConcurrentHashMap<>();
    /** sessionId -> username */
    private final ConcurrentHashMap<String, String>  sessionUserMap    = new ConcurrentHashMap<>();
    /** roomId -> session start time */
    private final ConcurrentHashMap<String, Instant> roomStartTime     = new ConcurrentHashMap<>();

    // ─── Send a Chat Message ──────────────────────────────────────────────────

    /**
     * Client sends to /app/chat/{roomId}
     * Backend broadcasts to /topic/chat/{roomId}
     * Payload is AES-256-GCM encrypted — backend is a pass-through.
     */
    @MessageMapping("/chat/{roomId}")
    public void handleMessage(
            @DestinationVariable String roomId,
            @Payload ChatMessage message,
            Principal principal) {

        if (principal == null) {
            log.warn("Unauthenticated WS message to room {} — dropping", roomId);
            return;
        }

        // Verify sender is an accepted member
        GroupRoom room = groupRoomService.findById(roomId).orElse(null);
        if (room == null || room.getStatus() == GroupRoom.RoomStatus.BURNED) {
            log.warn("Message to burned/nonexistent room {} from {} — dropping", roomId, principal.getName());
            return;
        }
        if (!room.getAcceptedUsernames().contains(principal.getName())) {
            log.warn("Unauthorized WS message to room {} from {} — dropping", roomId, principal.getName());
            return;
        }

        message.setSender(principal.getName());
        message.setRoomId(roomId);
        message.setTimestamp(Instant.now());
        if (message.getType() == null) message.setType(ChatMessage.MessageType.TEXT);

        int payloadLen = message.getEncryptedPayload() != null ? message.getEncryptedPayload().length() : 0;
        log.info("Relaying {} message in room {} from {} — payload size: {} bytes",
            message.getType(), roomId, principal.getName(), payloadLen);

        // Store in memory buffer (max 50 messages — no disk, no MongoDB)
        roomStore.addMessage(roomId, message);

        // Broadcast to all subscribers of this room
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, message);
        log.debug("Relayed {} message in room {} from {}", message.getType(), roomId, principal.getName());
    }

    // ─── Subscribe / Unsubscribe Events ──────────────────────────────────────

    @EventListener
    public void handleSubscribeEvent(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        String sessionId   = accessor.getSessionId();
        String username    = event.getUser() != null ? event.getUser().getName() : null;

        if (destination == null || !destination.startsWith("/topic/chat/") || username == null) return;

        String roomId = destination.replace("/topic/chat/", "");
        sessionRoomMap.put(sessionId, roomId);
        sessionUserMap.put(sessionId, username);
        roomStartTime.putIfAbsent(roomId, Instant.now());

        int count = roomStore.addSubscriber(roomId, username);
        log.info("User {} subscribed to room {} (total subscribers: {})", username, roomId, count);

        // Broadcast JOIN system message
        ChatMessage join = new ChatMessage();
        join.setType(ChatMessage.MessageType.JOIN);
        join.setSender(username);
        join.setRoomId(roomId);
        join.setTimestamp(Instant.now());
        join.setEncryptedPayload(username + " joined the vault");
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, join);

        // Send recent message history to the newly joined user
        var history = roomStore.getMessages(roomId);
        if (!history.isEmpty()) {
            messagingTemplate.convertAndSendToUser(
                username, "/queue/history/" + roomId,
                Map.of("type", "HISTORY", "messages", history, "roomId", roomId)
            );
        }
    }

    @EventListener
    public void handleUnsubscribeEvent(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        handleExit(accessor.getSessionId(), event.getUser() != null ? event.getUser().getName() : null);
    }

    @EventListener
    public void handleDisconnectEvent(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        handleExit(accessor.getSessionId(), event.getUser() != null ? event.getUser().getName() : null);
    }

    private void handleExit(String sessionId, String username) {
        String roomId = sessionRoomMap.remove(sessionId);
        if (roomId == null) return;
        sessionUserMap.remove(sessionId);
        if (username == null) username = "unknown";

        int remaining = roomStore.removeSubscriber(roomId, username);
        log.info("User {} left room {} (remaining subscribers: {})", username, roomId, remaining);

        // Broadcast LEAVE system message
        ChatMessage leave = new ChatMessage();
        leave.setType(ChatMessage.MessageType.LEAVE);
        leave.setSender(username);
        leave.setRoomId(roomId);
        leave.setTimestamp(Instant.now());
        leave.setEncryptedPayload(username + " left the vault");
        try {
            messagingTemplate.convertAndSend("/topic/chat/" + roomId, leave);
        } catch (Exception ignored) {}

        // ─── Omni-Burn Trigger ───────────────────────────────────────────────
        // When the last subscriber leaves, execute the hard wipe
        if (remaining <= 0) {
            log.info("All subscribers gone from room {} — triggering Omni-Burn", roomId);
            Instant started = roomStartTime.remove(roomId);
            try {
                wipeRoomService.wipeRoom(roomId, started);
            } catch (Exception e) {
                log.error("Omni-Burn failed for room {}: {}", roomId, e.getMessage(), e);
            }
        }
    }
}
