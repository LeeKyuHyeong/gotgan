package com.kh.stock.stock.dto;

import com.kh.stock.domain.Category;
import com.kh.stock.domain.Stock;
import com.kh.stock.domain.StorageLocation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** 재고 묶음 응답(위치 상세/단건). dDay=남은 일수(만료없음 null), expiringSoon=D-3 이내. */
public record StockResponse(
        Long id,
        Long productId,
        String productName,
        String unit,
        BigDecimal quantity,
        LocalDate expiryDate,
        String memo,
        Long locationId,
        String locationName,
        String locationEmoji,
        Long categoryId,
        String categoryName,
        String categoryEmoji,
        String categoryColor,
        Long dDay,
        boolean expiringSoon
) {
    public static StockResponse from(Stock s, LocalDate today) {
        var p = s.getProduct();
        StorageLocation loc = s.getLocation();
        Category cat = p.getCategory();
        Long dDay = s.getExpiryDate() == null ? null : ChronoUnit.DAYS.between(today, s.getExpiryDate());
        boolean soon = dDay != null && dDay >= 0 && dDay <= 3;
        return new StockResponse(
                s.getId(), p.getId(), p.getName(), p.getUnit(), s.getQuantity(),
                s.getExpiryDate(), s.getMemo(),
                loc.getId(), loc.getName(), loc.getEmoji(),
                cat == null ? null : cat.getId(),
                cat == null ? null : cat.getName(),
                cat == null ? null : cat.getEmoji(),
                cat == null ? null : cat.getColor(),
                dDay, soon);
    }
}
