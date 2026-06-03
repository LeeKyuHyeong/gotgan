package com.kh.stock.auth.dto;

import com.kh.stock.household.dto.HouseholdSummary;

import java.util.List;

/** 로그인 결과: 자체 JWT + 사용자 + 소속 가구. needsOnboarding=가구 없음(온보딩으로). */
public record LoginResponse(
        String accessToken,
        long expiresInSeconds,
        UserDto user,
        List<HouseholdSummary> households,
        boolean needsOnboarding
) {}
