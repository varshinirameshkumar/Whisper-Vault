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
@Document(collection = "users")
public class User {
    @Id
    private String id = UUID.randomUUID().toString();

    @Indexed(unique = true)
    private String username;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;
    private String displayName;
    private boolean emailNotificationsEnabled = true;
    private Instant createdAt = Instant.now();
    private Instant lastLoginAt;

    /** Base64-encoded 64x64 JPEG — face-scan or uploaded avatar */
    private String avatarBase64;

    /** FACE | GHOST — controls what is shown in UI */
    private AvatarMode avatarMode = AvatarMode.GHOST;

    /** Optional bio / status line */
    private String bio;

    public enum AvatarMode { FACE, GHOST }
}
