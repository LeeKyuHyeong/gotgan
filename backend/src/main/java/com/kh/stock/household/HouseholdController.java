package com.kh.stock.household;

import com.kh.stock.household.dto.*;
import com.kh.stock.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/households")
public class HouseholdController {

    private final HouseholdService householdService;

    public HouseholdController(HouseholdService householdService) {
        this.householdService = householdService;
    }

    /** 새 가구 만들기 (온보딩). */
    @PostMapping
    public HouseholdResponse create(@AuthenticationPrincipal AuthUser me,
                                    @Valid @RequestBody CreateHouseholdRequest req) {
        return householdService.create(me.id(), req);
    }

    /** 초대코드로 합류 (온보딩). */
    @PostMapping("/join")
    public HouseholdResponse join(@AuthenticationPrincipal AuthUser me,
                                  @Valid @RequestBody JoinHouseholdRequest req) {
        return householdService.join(me.id(), req);
    }

    /** 초대 화면(가족장): 코드 + 멤버 현황. */
    @GetMapping("/{householdId}/invite")
    public InviteResponse invite(@AuthenticationPrincipal AuthUser me,
                                 @PathVariable Long householdId) {
        return householdService.getInvite(me.id(), householdId);
    }

    /** 초대코드 재발급(가족장). */
    @PostMapping("/{householdId}/invite/regenerate")
    public InviteResponse regenerate(@AuthenticationPrincipal AuthUser me,
                                     @PathVariable Long householdId) {
        return householdService.regenerateInvite(me.id(), householdId);
    }

    // ---------- 가구 관리 ----------

    /** 가구 상세 + 멤버 목록(구성원 누구나). */
    @GetMapping("/{householdId}")
    public HouseholdDetailResponse detail(@AuthenticationPrincipal AuthUser me,
                                          @PathVariable Long householdId) {
        return householdService.getDetail(me.id(), householdId);
    }

    /** 가구 이름 변경(가족장). */
    @PatchMapping("/{householdId}")
    public HouseholdDetailResponse rename(@AuthenticationPrincipal AuthUser me,
                                          @PathVariable Long householdId,
                                          @Valid @RequestBody RenameHouseholdRequest req) {
        return householdService.rename(me.id(), householdId, req);
    }

    /** 멤버 내보내기(가족장). */
    @DeleteMapping("/{householdId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void kick(@AuthenticationPrincipal AuthUser me,
                     @PathVariable Long householdId,
                     @PathVariable Long userId) {
        householdService.kickMember(me.id(), householdId, userId);
    }

    /** 가족장 넘기기(소유권 이양). */
    @PostMapping("/{householdId}/transfer")
    public HouseholdDetailResponse transfer(@AuthenticationPrincipal AuthUser me,
                                            @PathVariable Long householdId,
                                            @Valid @RequestBody TransferOwnershipRequest req) {
        return householdService.transferOwnership(me.id(), householdId, req);
    }

    /** 가구 나가기(멤버). */
    @PostMapping("/{householdId}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal AuthUser me, @PathVariable Long householdId) {
        householdService.leave(me.id(), householdId);
    }

    /** 가구 삭제(가족장). 되돌릴 수 없음. */
    @DeleteMapping("/{householdId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable Long householdId) {
        householdService.delete(me.id(), householdId);
    }
}
