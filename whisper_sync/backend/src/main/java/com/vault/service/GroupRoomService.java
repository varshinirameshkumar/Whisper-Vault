package com.vault.service;

import com.vault.model.GroupRoom;
import com.vault.repository.GroupRoomRepository;
import com.vault.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupRoomService {

    private final GroupRoomRepository groupRoomRepository;
    private final UserRepository      userRepository;
    private final EmailService        emailService;
    private final RoomStore           roomStore;

    @Value("${app.room.invite-token-expiry-minutes:30}")
    private int tokenExpiryMinutes;

    private static final SecureRandom RANDOM = new SecureRandom();

    // ─── Create private room ──────────────────────────────────────────────────

    public GroupRoom createRoom(String creatorUsername, List<String> invitedUsernames) {
        List<String> all = new ArrayList<>();
        all.add(creatorUsername);
        all.addAll(invitedUsernames);
        all = all.stream().distinct().collect(Collectors.toList());

        GroupRoom room = new GroupRoom();
        room.setCreatorUsername(creatorUsername);
        room.setInvitedUsernames(all);
        room.setAcceptedUsernames(new ArrayList<>(List.of(creatorUsername)));
        room.setStatus(GroupRoom.RoomStatus.PENDING);
        room.setMode(GroupRoom.RoomMode.PRIVATE);

        Map<String, String> tokens = new HashMap<>();
        for (String invitee : invitedUsernames) tokens.put(invitee, generateToken());
        room.setInviteTokens(tokens);
        groupRoomRepository.save(room);

        for (String invitee : invitedUsernames) {
            userRepository.findByUsername(invitee).ifPresent(user -> {
                if (user.isEmailNotificationsEnabled())
                    emailService.sendGroupRoomInvite(user.getEmail(), user.getUsername(),
                            creatorUsername, room.getId(), tokens.get(invitee));
            });
        }
        log.info("Private room {} created by {}", room.getId(), creatorUsername);
        return room;
    }

    // ─── Create public room ───────────────────────────────────────────────────

    public GroupRoom createPublicRoom(String creatorUsername) {
        GroupRoom room = new GroupRoom();
        room.setCreatorUsername(creatorUsername);
        room.setInvitedUsernames(new ArrayList<>(List.of(creatorUsername)));
        room.setAcceptedUsernames(new ArrayList<>(List.of(creatorUsername)));
        room.setStatus(GroupRoom.RoomStatus.ACTIVE);
        room.setMode(GroupRoom.RoomMode.PUBLIC);
        groupRoomRepository.save(room);
        log.info("Public room {} created by {}", room.getId(), creatorUsername);
        return room;
    }

    // ─── Join (private) ───────────────────────────────────────────────────────

    public Optional<GroupRoom> joinRoom(String roomId, String username) {
        return groupRoomRepository.findById(roomId).map(room -> {
            if (room.getStatus() == GroupRoom.RoomStatus.BURNED) return null;
            if (room.getMode() == GroupRoom.RoomMode.PUBLIC) {
                // Public: everyone can join as full member
                if (!room.getAcceptedUsernames().contains(username))
                    room.getAcceptedUsernames().add(username);
                if (!room.getInvitedUsernames().contains(username))
                    room.getInvitedUsernames().add(username);
                if (room.getStatus() == GroupRoom.RoomStatus.PENDING)
                    room.setStatus(GroupRoom.RoomStatus.ACTIVE);
                return groupRoomRepository.save(room);
            }
            if (!room.getInvitedUsernames().contains(username)) return null;
            if (!room.getAcceptedUsernames().contains(username))
                room.getAcceptedUsernames().add(username);
            if (room.getStatus() == GroupRoom.RoomStatus.PENDING)
                room.setStatus(GroupRoom.RoomStatus.ACTIVE);
            return groupRoomRepository.save(room);
        });
    }

    // ─── Spectate (public read-only) ──────────────────────────────────────────

    public Optional<GroupRoom> spectateRoom(String roomId, String username) {
        return groupRoomRepository.findById(roomId).map(room -> {
            if (room.getMode() != GroupRoom.RoomMode.PUBLIC) return null;
            if (room.getStatus() == GroupRoom.RoomStatus.BURNED) return null;
            if (!room.getSpectators().contains(username)) room.getSpectators().add(username);
            return groupRoomRepository.save(room);
        });
    }

    // ─── Knock (request to join public room) ─────────────────────────────────

    public Optional<GroupRoom> knockOnRoom(String roomId, String username) {
        return groupRoomRepository.findById(roomId).map(room -> {
            if (room.getMode() != GroupRoom.RoomMode.PUBLIC) return null;
            if (room.getStatus() == GroupRoom.RoomStatus.BURNED) return null;
            if (room.getAcceptedUsernames().contains(username)) return room; // already in
            room.getKnockRequests().put(username, Instant.now());
            return groupRoomRepository.save(room);
        });
    }

    // ─── Accept knock (owner promotes spectator to active chatter) ────────────

    public Optional<GroupRoom> acceptKnock(String roomId, String knockingUsername, String ownerUsername) {
        return groupRoomRepository.findById(roomId).map(room -> {
            if (!room.getCreatorUsername().equals(ownerUsername)) return null;
            room.getKnockRequests().remove(knockingUsername);
            room.getSpectators().remove(knockingUsername);
            if (!room.getAcceptedUsernames().contains(knockingUsername))
                room.getAcceptedUsernames().add(knockingUsername);
            if (!room.getInvitedUsernames().contains(knockingUsername))
                room.getInvitedUsernames().add(knockingUsername);
            return groupRoomRepository.save(room);
        });
    }

    // ─── Burn ─────────────────────────────────────────────────────────────────

    public Optional<GroupRoom> requestBurn(String roomId, String username) {
        return groupRoomRepository.findById(roomId).map(room -> {
            if (room.getStatus() == GroupRoom.RoomStatus.BURNED) return room;
            if (!room.getAcceptedUsernames().contains(username)) return null;
            if (!room.getBurnRequestedBy().contains(username)) room.getBurnRequestedBy().add(username);
            room.setStatus(GroupRoom.RoomStatus.BURNED);
            log.info("Room {} burned by {}", roomId, username);
            return groupRoomRepository.save(room);
        });
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    public Optional<GroupRoom> findById(String roomId) {
        return groupRoomRepository.findById(roomId);
    }

    public List<GroupRoom> findPendingRoomsForUser(String username) {
        return groupRoomRepository
            .findByInvitedUsernamesContainingAndStatusNot(username, GroupRoom.RoomStatus.BURNED)
            .stream().filter(r -> r.getStatus() != GroupRoom.RoomStatus.BURNED)
            .collect(Collectors.toList());
    }

    public List<GroupRoom> findPublicActiveRooms() {
        return groupRoomRepository.findByModeAndStatus(GroupRoom.RoomMode.PUBLIC, GroupRoom.RoomStatus.ACTIVE);
    }

    private String generateToken() {
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
