package com.kh.stock.household;

import com.kh.stock.household.dto.MeResponse;
import com.kh.stock.household.dto.UpdateMeRequest;
import com.kh.stock.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class MeController {

    private final HouseholdService householdService;

    public MeController(HouseholdService householdService) {
        this.householdService = householdService;
    }

    /** 현재 사용자 + 소속 가구. 로그인 후 진입점(온보딩 여부 판단). */
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AuthUser me) {
        return householdService.getMe(me.id());
    }

    /** 표시 이름 변경. */
    @PatchMapping("/me")
    public MeResponse updateMe(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody UpdateMeRequest req) {
        return householdService.updateDisplayName(me.id(), req.nickname());
    }
}
