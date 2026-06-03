package com.kh.stock.domain.type;

/** 플랫폼 권한. USER=일반, SYSTEM_ADMIN=운영자(어드민 웹). 가구 내 권한(가족장)은 {@link MembershipRole}. */
public enum UserRole {
    USER,
    SYSTEM_ADMIN
}
