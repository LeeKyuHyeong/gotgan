package com.kh.stock.household.dto;

import com.kh.stock.domain.type.MembershipRole;

/** 가구 생성/합류 결과. inviteCode 는 가족장에게만 채워짐. */
public record HouseholdResponse(
        Long id,
        String name,
        MembershipRole myRole,
        String inviteCode,
        int memberCount,
        int maxMembers
) {}
