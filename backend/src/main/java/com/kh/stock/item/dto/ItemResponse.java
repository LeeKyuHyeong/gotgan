package com.kh.stock.item.dto;

import com.kh.stock.domain.Category;
import com.kh.stock.domain.Item;
import com.kh.stock.domain.StorageLocation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** 아이템 응답. dDay=오늘 기준 남은 일수(만료 없으면 null, 지났으면 음수), expiringSoon=D-3 이내. */
public record ItemResponse(
        Long id,
        String name,
        BigDecimal quantity,
        String unit,
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
    public static ItemResponse from(Item i, LocalDate today) {
        StorageLocation loc = i.getLocation();
        Category cat = i.getCategory();
        Long dDay = i.getExpiryDate() == null ? null
                : ChronoUnit.DAYS.between(today, i.getExpiryDate());
        boolean soon = dDay != null && dDay >= 0 && dDay <= 3;
        return new ItemResponse(
                i.getId(), i.getName(), i.getQuantity(), i.getUnit(), i.getExpiryDate(), i.getMemo(),
                loc.getId(), loc.getName(), loc.getEmoji(),
                cat == null ? null : cat.getId(),
                cat == null ? null : cat.getName(),
                cat == null ? null : cat.getEmoji(),
                cat == null ? null : cat.getColor(),
                dDay, soon
        );
    }
}
