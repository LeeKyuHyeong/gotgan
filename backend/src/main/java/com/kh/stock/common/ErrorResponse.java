package com.kh.stock.common;

/** 표준 에러 응답 바디. */
public record ErrorResponse(int status, String message) {
}
