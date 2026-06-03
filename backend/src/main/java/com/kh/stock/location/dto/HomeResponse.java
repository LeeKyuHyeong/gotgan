package com.kh.stock.location.dto;

import java.util.List;

/** 홈 화면 한 방 조회: 전체 합계 + 위치 카드 목록. */
public record HomeResponse(
        long totalItemCount,
        long expiringSoonCount,
        List<LocationCardResponse> locations
) {}
