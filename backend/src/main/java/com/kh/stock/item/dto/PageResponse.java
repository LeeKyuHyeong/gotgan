package com.kh.stock.item.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/** 단순 페이지 응답(Spring Page 직렬화 경고 회피). */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext
) {
    public static <E, T> PageResponse<T> of(Page<E> p, Function<E, T> mapper) {
        return new PageResponse<>(
                p.getContent().stream().map(mapper).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.hasNext());
    }
}
