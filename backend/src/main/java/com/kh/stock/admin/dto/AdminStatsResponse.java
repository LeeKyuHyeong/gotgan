package com.kh.stock.admin.dto;

/** 어드민 대시보드 상단 통계(시안 ⑬). */
public record AdminStatsResponse(
        long pendingRequests,
        long totalCategories,
        long totalHouseholds
) {}
