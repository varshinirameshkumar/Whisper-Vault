package com.vault.controller;

import com.vault.dto.*;
import com.vault.model.ActivityLog;
import com.vault.model.User;
import com.vault.repository.UserRepository;
import com.vault.security.TokenProvider;
import com.vault.service.ActivityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Register, login, and profile management")
public class AuthController {

    private final UserRepository     userRepository;
    private final PasswordEncoder    passwordEncoder;
    private final AuthenticationManager authManager;
    private final TokenProvider      tokenProvider;
    private final ActivityService    activityService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        if (userRepository.existsByUsername(request.getUsername()))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error("Username already taken"));
        if (userRepository.existsByEmail(request.getEmail()))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error("Email already registered"));

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(request.getDisplayName() != null ? request.getDisplayName() : request.getUsername());
        userRepository.save(user);
        activityService.log(user.getUsername(), null, null, ActivityLog.ActivityType.USER_REGISTERED, httpRequest.getRemoteAddr());

        String token = tokenProvider.generateToken(user.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Account created successfully", new AuthResponse(token, toDto(user))));
    }

    @PostMapping("/login")
    @Operation(summary = "Login and receive JWT")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
            User user = userRepository.findByUsername(request.getUsername()).orElseThrow();
            user.setLastLoginAt(Instant.now());
            userRepository.save(user);
            activityService.log(user.getUsername(), null, null, ActivityLog.ActivityType.USER_LOGIN, httpRequest.getRemoteAddr());
            String token = tokenProvider.generateToken(user.getUsername());
            return ResponseEntity.ok(ApiResponse.ok(new AuthResponse(token, toDto(user))));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Invalid credentials"));
        }
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get current user profile")
    public ResponseEntity<ApiResponse<UserDTO>> me(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.ok(toDto(user)));
    }

    @GetMapping("/check-username")
    @Operation(summary = "Check if a username is available (public endpoint)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkUsername(
            @RequestParam String username) {
        if (username == null || username.trim().length() < 3)
            return ResponseEntity.badRequest().body(ApiResponse.error("Username too short"));
        String clean = username.trim().toLowerCase();
        if (!clean.matches("^[a-z0-9_]{3,30}$"))
            return ResponseEntity.badRequest().body(ApiResponse.error("Username must be 3-30 characters: letters, numbers, underscores only"));
        boolean taken = userRepository.existsByUsername(username.trim());
        Map<String, Object> result = new HashMap<>();
        result.put("username", username.trim());
        result.put("available", !taken);
        result.put("message", taken ? "Username already taken" : "Username is available");
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PutMapping("/me/notifications")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Toggle email notifications")
    public ResponseEntity<ApiResponse<UserDTO>> toggleNotifications(
            @RequestParam boolean enabled, Authentication auth) {
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        user.setEmailNotificationsEnabled(enabled);
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok("Notifications updated", toDto(user)));
    }

    // ─── Profile Update ───────────────────────────────────────────────────────

    @PutMapping("/me/profile")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Update display name, bio, avatar, avatar mode")
    public ResponseEntity<ApiResponse<UserDTO>> updateProfile(
            @RequestBody Map<String, String> body, Authentication auth) {
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        if (body.containsKey("displayName") && !body.get("displayName").isBlank())
            user.setDisplayName(body.get("displayName").trim());
        if (body.containsKey("bio"))
            user.setBio(body.get("bio"));
        if (body.containsKey("avatarBase64"))
            user.setAvatarBase64(body.get("avatarBase64"));
        if (body.containsKey("avatarMode")) {
            try { user.setAvatarMode(User.AvatarMode.valueOf(body.get("avatarMode"))); }
            catch (IllegalArgumentException ignored) {}
        }
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok("Profile updated", toDto(user)));
    }

    // ─── Password Rotation ────────────────────────────────────────────────────

    @PutMapping("/me/password")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Change password — requires current password BCrypt check")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @RequestBody Map<String, String> body, Authentication auth) {
        String currentPw = body.get("currentPassword");
        String newPw     = body.get("newPassword");
        if (currentPw == null || newPw == null || newPw.length() < 8)
            return ResponseEntity.badRequest().body(ApiResponse.error("New password must be at least 8 characters"));

        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        if (!passwordEncoder.matches(currentPw, user.getPasswordHash()))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Current password is incorrect"));

        user.setPasswordHash(passwordEncoder.encode(newPw));
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully"));
    }

    // ─── DTO mapper ───────────────────────────────────────────────────────────

    public UserDTO toDto(User user) {
        return new UserDTO(
            user.getId(), user.getUsername(), user.getEmail(),
            user.getDisplayName(), user.isEmailNotificationsEnabled(),
            user.getCreatedAt(), user.getLastLoginAt(),
            user.getAvatarBase64(), user.getAvatarMode(), user.getBio()
        );
    }

    // ─── Health Check (for Railway deployment) ────────────────────────────────

    @GetMapping("/health")
    @Operation(summary = "Health check endpoint")
    public ResponseEntity<ApiResponse<String>> health() {
        return ResponseEntity.ok(ApiResponse.ok("WhisperVault is running"));
    }
}
