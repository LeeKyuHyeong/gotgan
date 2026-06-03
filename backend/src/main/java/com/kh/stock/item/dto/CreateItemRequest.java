package com.kh.stock.item.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateItemRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull Long locationId,
        Long categoryId,
        @NotNull @DecimalMin("0") BigDecimal quantity,
        @Size(max = 20) String unit,
        LocalDate expiryDate,
        @Size(max = 255) String memo
) {}
