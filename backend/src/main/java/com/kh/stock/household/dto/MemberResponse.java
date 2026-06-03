package com.kh.stock.household.dto;

import com.kh.stock.domain.Membership;
import com.kh.stock.domain.type.MembershipRole;

public record MemberResponse(
        Long userId,
        String nickname,
        MembershipRole role
) {
    public static MemberResponse from(Membership m) {
        return new MemberResponse(
                m.getUser().getId(),
                m.getUser().getNickname(),
                m.getRole()
        );
    }
}
