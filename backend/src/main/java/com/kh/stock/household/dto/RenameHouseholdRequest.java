package com.kh.stock.household.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 가구 이름 변경(가족장). */
public record RenameHouseholdRequest(
        @NotBlank @Size(max = 50) String name
) {}
