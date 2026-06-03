package com.kh.stock.household.dto;

import com.kh.stock.auth.dto.UserDto;

import java.util.List;

/** GET /api/me — 현재 사용자 + 소속 가구. */
public record MeResponse(
        UserDto user,
        List<HouseholdSummary> households,
        boolean needsOnboarding
) {}
