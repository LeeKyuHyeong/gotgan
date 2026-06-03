package com.kh.stock.admin.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 분류 요청 승인 — 승인 시 이모지/이름/순서/색상을 지정해 공통 분류로 만든다.
 * 모두 optional: name 비우면 요청명 그대로, emoji 비우면 요청 이모지, sortOrder 비우면 맨 뒤, color 비우면 미지정.
 */
public record ApproveRequestRequest(
        @Size(max = 40) String name,
        @Size(max = 16) String emoji,
        @Pattern(regexp = "^$|^#[0-9a-fA-F]{6}$", message = "색상은 #rrggbb 형식이어야 합니다.") String color,
        Integer sortOrder
) {}
