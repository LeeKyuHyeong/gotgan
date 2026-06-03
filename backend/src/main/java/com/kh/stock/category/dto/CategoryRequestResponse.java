package com.kh.stock.category.dto;

import com.kh.stock.domain.CategoryRequest;
import com.kh.stock.domain.type.RequestStatus;

import java.time.LocalDateTime;

/** 분류 추가 요청 조회용. 승인되면 resolvedCategoryName 으로 어떤 공통 분류가 되었는지 표시. */
public record CategoryRequestResponse(
        Long id,
        String requestedName,
        String suggestedEmoji,
        RequestStatus status,
        String resolvedCategoryName,
        LocalDateTime createdAt
) {
    public static CategoryRequestResponse from(CategoryRequest r) {
        return new CategoryRequestResponse(
                r.getId(),
                r.getRequestedName(),
                r.getSuggestedEmoji(),
                r.getStatus(),
                r.getResolvedCategory() != null ? r.getResolvedCategory().getName() : null,
                r.getCreatedAt()
        );
    }
}
