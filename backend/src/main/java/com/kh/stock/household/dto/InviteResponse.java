package com.kh.stock.household.dto;

import java.util.List;

/** 초대 화면: 코드 + 멤버 현황. 가족장만 조회. */
public record InviteResponse(
        String inviteCode,
        int memberCount,
        int maxMembers,
        List<MemberResponse> members
) {}
