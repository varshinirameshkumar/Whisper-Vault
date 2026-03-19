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
@Document(collection = "activity_logs")
public class ActivityLog {
    @Id
    private String id = UUID.randomUUID().toString();

    private String actorUsername;
    private String targetUsername;
    private String secretId;
    private ActivityType type;
    private String ipAddress;
    private Instant timestamp = Instant.now();

    @Indexed(expireAfterSeconds = 2592000) // 30-day log retention
    private Instant logExpiresAt = Instant.now().plusSeconds(2592000);

    public enum ActivityType {
        SECRET_SENT, SECRET_BURNED, SECRET_EXPIRED, USER_REGISTERED, USER_LOGIN,
        ROOM_CREATED, ROOM_JOINED, ROOM_BURNED
    }
}