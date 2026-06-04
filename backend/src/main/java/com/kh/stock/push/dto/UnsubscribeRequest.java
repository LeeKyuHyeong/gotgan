package com.kh.stock.push.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UnsubscribeRequest(
        @NotBlank @Size(max = 500) String endpoint
) {}
