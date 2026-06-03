package com.kh.stock.item.dto;

import com.kh.stock.domain.ItemHistory;
import com.kh.stock.domain.type.ItemAction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 변동 이력 한 줄. itemName 은 당시 스냅샷. */
public record HistoryResponse(
        Long id,
        Long itemId,
        String itemName,
        ItemAction action,
        BigDecimal delta,
        BigDecimal quantityAfter,
        String userNickname,
        LocalDateTime createdAt
) {
    public static HistoryResponse from(ItemHistory h) {
        return new HistoryResponse(
                h.getId(),
                h.getItem().getId(),
                h.getItemNameSnapshot(),
                h.getAction(),
                h.getDelta(),
                h.getQuantityAfter(),
                h.getUser().getNickname(),
                h.getCreatedAt()
        );
    }
}
