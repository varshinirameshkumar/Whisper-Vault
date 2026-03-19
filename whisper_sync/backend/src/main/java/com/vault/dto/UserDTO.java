package com.vault.dto;

import com.vault.model.User;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private String id;
    private String username;
    private String email;
    private String displayName;
    private boolean emailNotificationsEnabled;
    private Instant createdAt;
    private Instant lastLoginAt;
    private String avatarBase64;
    private User.AvatarMode avatarMode;
    private String bio;
}
