package com.vault.controller;

import com.vault.dto.ApiResponse;
import com.vault.dto.UserDTO;
import com.vault.model.User;
import com.vault.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Users", description = "User search for recipient selection")
public class UserSearchController {

    private final UserRepository userRepository;

    @GetMapping("/search")
    @Operation(summary = "Search users by username or display name")
    public ResponseEntity<ApiResponse<List<UserDTO>>> searchUsers(
            @RequestParam String q,
            Authentication auth) {

        if (q == null || q.trim().length() < 1) {
            return ResponseEntity.ok(ApiResponse.ok(List.of()));
        }

        List<UserDTO> results = userRepository
                .searchByUsernameOrDisplayName(q.trim())
                .stream()
                .filter(u -> !u.getUsername().equals(auth.getName()))
                .limit(10)
                .map(this::toPublicDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(results));
    }

    private UserDTO toPublicDto(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setDisplayName(user.getDisplayName());
        return dto;
    }
}