package com.kh.stock.location.dto;

/** 홈 화면 위치 카드: 아이템 수 + 곧만료(D-3) 수 포함. */
public record LocationCardResponse(
        Long id,
        String name,
        String emoji,
        int sortOrder,
        long itemCount,
        long expiringSoonCount
) {}
