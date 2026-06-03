package com.kh.stock.location.dto;

import com.kh.stock.domain.StorageLocation;

public record LocationResponse(Long id, String name, String emoji, int sortOrder) {
    public static LocationResponse from(StorageLocation l) {
        return new LocationResponse(l.getId(), l.getName(), l.getEmoji(), l.getSortOrder());
    }
}
