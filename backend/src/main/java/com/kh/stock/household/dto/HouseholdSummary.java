package com.kh.stock.household.dto;

import com.kh.stock.domain.Membership;
import com.kh.stock.domain.type.MembershipRole;

/** 사용자가 속한 가구 요약 (가구 전환 UI / 로그인 응답). */
public record HouseholdSummary(
        Long householdId,
        String name,
        MembershipRole myRole
) {
    public static HouseholdSummary from(Membership m) {
        return new HouseholdSummary(
                m.getHousehold().getId(),
                m.getHousehold().getName(),
                m.getRole()
        );
    }
}
