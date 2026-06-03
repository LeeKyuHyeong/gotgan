package com.kh.stock.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 프론트가 카카오에서 받은 인가코드를 전달. redirectUri 는 선택(미지정 시 서버 기본값). */
public record KakaoLoginRequest(
        @NotBlank String code,
        String redirectUri
) {}
