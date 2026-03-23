package com.vault.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;
import java.util.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "group_rooms")
public class GroupRoom {

    @Id
    private String id = UUID.randomUUID().toString();

    private String creatorUsername;
    private String groupName;  // Optional display name for the room

    /** Private: invited. Public: initially empty — anyone can spectate. */
    private List<String> invitedUsernames  = new ArrayList<>();
    private List<String> acceptedUsernames = new ArrayList<>();

    private RoomStatus status = RoomStatus.PENDING;
    private RoomMode   mode   = RoomMode.PRIVATE;

    /** Short-lived invite tokens (private rooms) */
    private Map<String, String> inviteTokens = new HashMap<>();

    /** Spectators who are watching a PUBLIC room (read-only WS) */
    private List<String> spectators = new ArrayList<>();

    /** Knock requests: username -> timestamp */
    private Map<String, Instant> knockRequests = new HashMap<>();

    /** Usernames who requested a burn */
    private List<String> burnRequestedBy = new ArrayList<>();

    private Instant createdAt = Instant.now();

    @Indexed(expireAfterSeconds = 0)
    private Instant expiresAt = Instant.now().plusSeconds(7200);

    public enum RoomStatus { PENDING, ACTIVE, BURNED }
    public enum RoomMode   { PRIVATE, PUBLIC }
}
