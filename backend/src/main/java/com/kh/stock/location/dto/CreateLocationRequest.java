package com.kh.stock.location.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateLocationRequest(
        @NotBlank @Size(max = 50) String name,
        @Size(max = 16) String emoji
) {}
