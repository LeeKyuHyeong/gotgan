package com.kh.stock.household.dto;

import jakarta.validation.constraints.NotNull;

/** 가족장 넘기기(소유권 이양) — 대상 멤버의 userId. */
public record TransferOwnershipRequest(
        @NotNull Long userId
) {}
