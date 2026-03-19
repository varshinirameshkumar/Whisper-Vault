package com.vault.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SecretRequestDTO {
    @NotBlank
    private String recipientUsername;

    @NotBlank @Size(max = 10000)
    private String content;

    private String subject;

    @Min(1) @Max(168)
    private int expiryHours = 24;
}