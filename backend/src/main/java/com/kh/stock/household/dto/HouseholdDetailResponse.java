package com.kh.stock.household.dto;

import com.kh.stock.domain.type.MembershipRole;

import java.util.List;

/** 가구 관리 화면: 이름·내 권한·멤버 목록(+가족장만 초대코드). */
public record HouseholdDetailResponse(
        Long id,
        String name,
        MembershipRole myRole,
        String inviteCode,   // 가족장만 채워짐
        Long ownerUserId,
        int memberCount,
        int maxMembers,
        List<MemberResponse> members
) {}
