package com.kh.stock.auth.dto;

import com.kh.stock.domain.AppUser;
import com.kh.stock.domain.type.UserRole;

/** 사용자 식별 정보 응답. */
public record UserDto(
        Long id,
        String nickname,
        String profileImageUrl,
        UserRole role
) {
    public static UserDto from(AppUser u) {
        return new UserDto(u.getId(), u.getNickname(), u.getProfileImageUrl(), u.getRole());
    }
}
