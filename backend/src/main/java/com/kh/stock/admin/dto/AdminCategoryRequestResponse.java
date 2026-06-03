package com.kh.stock.admin.dto;

import com.kh.stock.domain.CategoryRequest;
import com.kh.stock.domain.type.RequestStatus;

import java.time.LocalDateTime;

/** 어드민 분류 요청 목록 항목(시안 ⑬). sameNameCount = 같은 이름의 동일 상태 요청 수("N명 요청"). */
public record AdminCategoryRequestResponse(
        Long id,
        String requestedName,
        String suggestedEmoji,
        RequestStatus status,
        String requesterNickname,
        String householdName,
        long sameNameCount,
        LocalDateTime createdAt
) {
    public static AdminCategoryRequestResponse from(CategoryRequest r, long sameNameCount) {
        return new AdminCategoryRequestResponse(
                r.getId(),
                r.getRequestedName(),
                r.getSuggestedEmoji(),
                r.getStatus(),
                r.getRequestedBy() != null ? r.getRequestedBy().getNickname() : null,
                r.getHousehold() != null ? r.getHousehold().getName() : null,
                sameNameCount,
                r.getCreatedAt()
        );
    }
}
