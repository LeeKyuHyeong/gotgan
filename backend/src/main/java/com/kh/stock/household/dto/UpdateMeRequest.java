package com.kh.stock.household.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 표시 이름(닉네임) 변경. */
public record UpdateMeRequest(
        @NotBlank @Size(max = 50) String nickname
) {}
