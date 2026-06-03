package com.kh.stock.security;

import com.kh.stock.domain.type.UserRole;

/** 인증된 사용자 principal. 컨트롤러에서 @AuthenticationPrincipal AuthUser 로 주입. */
public record AuthUser(Long id, UserRole role) {
}
