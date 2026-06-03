package com.kh.stock.item.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 아이템 전체 수정. 수량 변경분은 이력에 UPDATE 로 기록(증감 버튼은 /adjust 사용). */
public record UpdateItemRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull Long locationId,
        Long categoryId,
        @NotNull @DecimalMin("0") BigDecimal quantity,
        @Size(max = 20) String unit,
        LocalDate expiryDate,
        @Size(max = 255) String memo
) {}
