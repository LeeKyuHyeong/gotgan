package com.kh.stock.household;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.AppUser;
import com.kh.stock.domain.Household;
import com.kh.stock.domain.Membership;
import com.kh.stock.domain.type.MembershipRole;
import com.kh.stock.household.dto.HouseholdResponse;
import com.kh.stock.household.dto.JoinHouseholdRequest;
import com.kh.stock.repository.AppUserRepository;
import com.kh.stock.repository.CategoryRequestRepository;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.ItemHistoryRepository;
import com.kh.stock.repository.MembershipRepository;
import com.kh.stock.repository.ProductGroupRepository;
import com.kh.stock.repository.ProductRepository;
import com.kh.stock.repository.StockRepository;
import com.kh.stock.repository.StorageLocationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HouseholdServiceJoinTest {

    @Mock HouseholdRepository householdRepository;
    @Mock MembershipRepository membershipRepository;
    @Mock StorageLocationRepository locationRepository;
    @Mock AppUserRepository userRepository;
    @Mock StockRepository stockRepository;
    @Mock ProductRepository productRepository;
    @Mock ProductGroupRepository groupRepository;
    @Mock ItemHistoryRepository itemHistoryRepository;
    @Mock CategoryRequestRepository categoryRequestRepository;
    @Mock InviteCodeGenerator inviteCodeGenerator;

    @InjectMocks HouseholdService service;

    private Household household(long id, int max, String code) {
        Household h = new Household();
        h.setId(id);
        h.setName("우리집");
        h.setMaxMembers(max);
        h.setInviteCode(code);
        return h;
    }

    /** 이미 그 가구의 구성원인 사용자가 초대코드로 다시 합류해도 conflict 가 아니라
     *  그 가구 정보를 그대로 돌려줘야(멱등) 프런트가 메인으로 들어갈 수 있다.
     *  (초대 랜딩이 로그인 사용자를 항상 합류 폼으로 보내므로, 한 번 합류한 사람·가족장 본인이
     *   초대링크/코드를 다시 쓰면 "이미 구성원" 에러에 영구히 갇히던 버그를 막는다.) */
    @Test
    void join_whenAlreadyMember_isIdempotent() {
        Household h = household(7L, 4, "K7M3PQ");
        Membership existing = new Membership();
        existing.setHousehold(h);
        existing.setRole(MembershipRole.OWNER);

        when(householdRepository.findByInviteCodeForUpdate("K7M3PQ")).thenReturn(Optional.of(h));
        when(membershipRepository.findByUserIdAndHouseholdId(1L, 7L)).thenReturn(Optional.of(existing));
        when(membershipRepository.countByHouseholdId(7L)).thenReturn(2L);

        HouseholdResponse res = service.join(1L, new JoinHouseholdRequest("K7M3PQ"));

        assertThat(res.id()).isEqualTo(7L);
        assertThat(res.myRole()).isEqualTo(MembershipRole.OWNER);
        assertThat(res.memberCount()).isEqualTo(2);
        // 이미 멤버이므로 새 멤버십을 만들면 안 된다.
        verify(membershipRepository, never()).save(any());
    }

    /** (E2) 존재하지 않는 코드 → 404. */
    @Test
    void join_whenInviteCodeInvalid_throwsNotFound() {
        when(householdRepository.findByInviteCodeForUpdate("BADCOD")).thenReturn(Optional.empty());

        ApiException ex = catchThrowableOfType(
                ApiException.class, () -> service.join(1L, new JoinHouseholdRequest("BADCOD")));

        assertThat(ex).isNotNull();
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ex.getMessage()).isEqualTo("초대코드가 올바르지 않습니다.");
        verify(membershipRepository, never()).save(any());
    }

    /** (E2) 정원이 가득 찬 가구에 신규 합류 → 409. */
    @Test
    void join_whenHouseholdFull_throwsConflict() {
        Household h = household(7L, 4, "K7M3PQ");
        when(householdRepository.findByInviteCodeForUpdate("K7M3PQ")).thenReturn(Optional.of(h));
        when(membershipRepository.findByUserIdAndHouseholdId(2L, 7L)).thenReturn(Optional.empty());
        when(membershipRepository.countByHouseholdId(7L)).thenReturn(4L); // == maxMembers

        ApiException ex = catchThrowableOfType(
                ApiException.class, () -> service.join(2L, new JoinHouseholdRequest("K7M3PQ")));

        assertThat(ex).isNotNull();
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(ex.getMessage()).isEqualTo("가구 인원이 가득 찼습니다.");
        verify(membershipRepository, never()).save(any());
    }

    /** (E2) 정상 신규 합류 → MEMBER 멤버십 저장, memberCount+1. */
    @Test
    void join_whenNewMember_savesMembership() {
        Household h = household(7L, 4, "K7M3PQ");
        when(householdRepository.findByInviteCodeForUpdate("K7M3PQ")).thenReturn(Optional.of(h));
        when(membershipRepository.findByUserIdAndHouseholdId(2L, 7L)).thenReturn(Optional.empty());
        when(membershipRepository.countByHouseholdId(7L)).thenReturn(2L);
        when(userRepository.getReferenceById(2L)).thenReturn(new AppUser());

        HouseholdResponse res = service.join(2L, new JoinHouseholdRequest("K7M3PQ"));

        assertThat(res.id()).isEqualTo(7L);
        assertThat(res.myRole()).isEqualTo(MembershipRole.MEMBER);
        assertThat(res.memberCount()).isEqualTo(3); // 2 + 본인
        verify(membershipRepository).save(any(Membership.class));
    }

    /** (A6) 소문자·공백 코드도 대문자/trim 정규화해서 조회한다. */
    @Test
    void join_normalizesInviteCode() {
        Household h = household(7L, 4, "K7M3PQ");
        Membership existing = new Membership();
        existing.setHousehold(h);
        existing.setRole(MembershipRole.MEMBER);
        // 이미 멤버로 두어 멱등 경로로 짧게 끝내고, 조회 인자만 검증한다.
        when(householdRepository.findByInviteCodeForUpdate("K7M3PQ")).thenReturn(Optional.of(h));
        when(membershipRepository.findByUserIdAndHouseholdId(1L, 7L)).thenReturn(Optional.of(existing));
        when(membershipRepository.countByHouseholdId(7L)).thenReturn(1L);

        service.join(1L, new JoinHouseholdRequest("  k7m3pq  "));

        verify(householdRepository).findByInviteCodeForUpdate("K7M3PQ");
    }
}
