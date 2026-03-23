package com.vault.controller;

import com.vault.dto.ApiResponse;
import com.vault.model.ActivityLog;
import com.vault.model.GroupRoom;
import com.vault.service.ActivityService;
import com.vault.service.GroupRoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@Tag(name = "Group Rooms", description = "Ephemeral Whisper-Sync group vault rooms")
public class GroupRoomController {

    private final GroupRoomService     groupRoomService;
    private final ActivityService      activityService;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    // ─── Create private room ──────────────────────────────────────────────────
    @PostMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Create a private group vault room")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createRoom(
            @RequestBody Map<String, Object> body, Authentication auth, HttpServletRequest req) {
        @SuppressWarnings("unchecked")
        List<String> invitees = (List<String>) body.get("invitedUsernames");
        String groupName = (String) body.get("groupName");
        if (invitees == null || invitees.isEmpty())
            return ResponseEntity.badRequest().body(ApiResponse.error("At least one invitee is required"));

        GroupRoom room = groupRoomService.createRoom(auth.getName(), invitees, groupName);
        try { activityService.log(auth.getName(), String.join(",", invitees), room.getId(), ActivityLog.ActivityType.ROOM_CREATED, req.getRemoteAddr()); } catch (Exception ignored) {}

        Map<String, Object> payload = new HashMap<>();
        payload.put("roomId", room.getId());
        payload.put("status", room.getStatus().name());
        payload.put("groupName", room.getGroupName());
        payload.put("invitees", room.getInvitedUsernames());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Room created. Invites dispatched.", payload));
    }

    @PostMapping("/public")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Create a public spectator vault room")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createPublicRoom(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth, HttpServletRequest req) {
        String groupName = body != null ? (String) body.get("groupName") : null;
        GroupRoom room = groupRoomService.createPublicRoom(auth.getName(), groupName);
        try { activityService.log(auth.getName(), "PUBLIC", room.getId(), ActivityLog.ActivityType.ROOM_CREATED, req.getRemoteAddr()); } catch (Exception ignored) {}
        Map<String, Object> p = new HashMap<>();
        p.put("roomId", room.getId()); p.put("mode", "PUBLIC"); p.put("status", "ACTIVE"); p.put("groupName", room.getGroupName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Public room created", p));
    }

    // ─── Add participant to existing room ─────────────────────────────────────
    @PostMapping("/{roomId}/add-participant")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Creator adds a new participant to an active room")
    public ResponseEntity<ApiResponse<String>> addParticipant(
            @PathVariable String roomId,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        String username = body.get("username");
        if (username == null || username.isBlank())
            return ResponseEntity.badRequest().body(ApiResponse.error("Username is required"));

        return groupRoomService.addParticipant(roomId, username, auth.getName())
            .map(room -> ResponseEntity.ok(ApiResponse.ok("Invite sent to " + username)))
            .orElse(ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Only the creator can add participants, or room not found")));
    }

    // ─── List public active rooms ─────────────────────────────────────────────
    @GetMapping("/public")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all public active rooms for spectating")
    public ResponseEntity<ApiResponse<List<GroupRoom>>> listPublicRooms() {
        return ResponseEntity.ok(ApiResponse.ok(groupRoomService.findPublicActiveRooms()));
    }

    // ─── List my rooms ────────────────────────────────────────────────────────
    @GetMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List active rooms for current user (excludes BURNED)")
    public ResponseEntity<ApiResponse<List<GroupRoom>>> myRooms(Authentication auth) {
        List<GroupRoom> rooms = groupRoomService.findPendingRoomsForUser(auth.getName())
            .stream().filter(r -> r.getStatus() != GroupRoom.RoomStatus.BURNED).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(rooms));
    }

    // ─── Join ─────────────────────────────────────────────────────────────────
    @PostMapping("/{roomId}/join")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Join a room")
    public ResponseEntity<ApiResponse<Map<String, Object>>> joinRoom(
            @PathVariable String roomId, Authentication auth, HttpServletRequest req) {
        return groupRoomService.joinRoom(roomId, auth.getName()).map(room -> {
            try { activityService.log(auth.getName(), room.getCreatorUsername(), roomId, ActivityLog.ActivityType.ROOM_JOINED, req.getRemoteAddr()); } catch (Exception ignored) {}
            Map<String, Object> p = new HashMap<>(); p.put("roomId", room.getId()); p.put("status", room.getStatus().name());
            return ResponseEntity.<ApiResponse<Map<String, Object>>>ok(ApiResponse.ok("Joined room", p));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Room not found or not invited")));
    }

    // ─── Spectate ─────────────────────────────────────────────────────────────
    @PostMapping("/{roomId}/spectate")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Join as read-only spectator (public rooms only)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> spectate(
            @PathVariable String roomId, Authentication auth) {
        return groupRoomService.spectateRoom(roomId, auth.getName()).map(room -> {
            Map<String, Object> p = new HashMap<>(); p.put("roomId", room.getId()); p.put("role", "SPECTATOR");
            return ResponseEntity.<ApiResponse<Map<String, Object>>>ok(ApiResponse.ok("Spectating", p));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Room not found or not public")));
    }

    // ─── Knock ────────────────────────────────────────────────────────────────
    @PostMapping("/{roomId}/knock")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Request to join as active chatter (public rooms)")
    public ResponseEntity<ApiResponse<String>> knock(
            @PathVariable String roomId, Authentication auth) {
        return groupRoomService.knockOnRoom(roomId, auth.getName()).map(room -> {
            // Notify the room owner via WebSocket toast
            messagingTemplate.convertAndSend("/topic/chat/" + roomId, Map.of(
                "type", "KNOCK_REQUEST",
                "sender", auth.getName(),
                "roomId", roomId,
                "message", auth.getName() + " wants to join the conversation"
            ));
            return ResponseEntity.ok(ApiResponse.ok("Knock sent to room owner"));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Room not found")));
    }

    // ─── Accept knock ─────────────────────────────────────────────────────────
    @PostMapping("/{roomId}/accept-knock/{username}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Owner accepts a knock — upgrades spectator to active chatter")
    public ResponseEntity<ApiResponse<String>> acceptKnock(
            @PathVariable String roomId, @PathVariable String username, Authentication auth) {
        return groupRoomService.acceptKnock(roomId, username, auth.getName()).map(room -> {
            // Notify the room: spectator has been promoted
            messagingTemplate.convertAndSend("/topic/chat/" + roomId, Map.of(
                "type", "KNOCK_ACCEPTED",
                "sender", "SYSTEM",
                "targetUser", username,
                "roomId", roomId,
                "message", username + " has been granted access to the conversation"
            ));
            return ResponseEntity.ok(ApiResponse.ok(username + " promoted to active chatter"));
        }).orElse(ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Not authorized or room not found")));
    }

    // ─── Burn ─────────────────────────────────────────────────────────────────
    @PostMapping("/{roomId}/burn")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Burn the room permanently")
    public ResponseEntity<ApiResponse<Map<String, Object>>> burnRoom(
            @PathVariable String roomId, Authentication auth, HttpServletRequest req) {
        return groupRoomService.requestBurn(roomId, auth.getName()).map(room -> {
            try { activityService.log(auth.getName(), "ROOM:" + roomId, roomId, ActivityLog.ActivityType.ROOM_BURNED, req.getRemoteAddr()); } catch (Exception ignored) {}
            Map<String, Object> p = new HashMap<>(); p.put("roomId", room.getId()); p.put("status", room.getStatus().name()); p.put("burnedBy", auth.getName());
            return ResponseEntity.<ApiResponse<Map<String, Object>>>ok(ApiResponse.ok("Room burned", p));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Room not found or not a participant")));
    }

    // ─── Email verify ─────────────────────────────────────────────────────────
    @GetMapping("/verify/{token}")
    @Operation(summary = "Email verification link redirect")
    public ResponseEntity<Void> verifyInviteToken(@PathVariable String token, @RequestParam String username) {
        boolean ok = groupRoomService.findPendingRoomsForUser(username).stream()
            .anyMatch(r -> r.getInviteTokens().containsValue(token));
        String dest = ok
            ? frontendUrl + "/vault?inviteToken=" + token + "&username=" + username
            : frontendUrl + "/login?error=invalid_invite";
        return ResponseEntity.status(HttpStatus.FOUND).header("Location", dest).build();
    }

    // ─── Get room ─────────────────────────────────────────────────────────────
    @GetMapping("/{roomId}")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<GroupRoom>> getRoom(@PathVariable String roomId, Authentication auth) {
        return groupRoomService.findById(roomId)
            .filter(r -> r.getInvitedUsernames().contains(auth.getName())
                      || r.getSpectators().contains(auth.getName())
                      || r.getMode() == GroupRoom.RoomMode.PUBLIC)
            .map(r -> ResponseEntity.ok(ApiResponse.ok(r)))
            .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Room not found")));
    }
}
