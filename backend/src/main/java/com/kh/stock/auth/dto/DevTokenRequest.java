package com.kh.stock.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 로컬 개발용 토큰 발급 요청 (카카오 없이 테스트). prod 프로파일에선 비활성. */
public record DevTokenRequest(
        @NotBlank String kakaoId,
        String nickname,
        Boolean admin   // true 면 SYSTEM_ADMIN 으로 발급(어드민 화면 테스트용, dev 전용)
) {}
