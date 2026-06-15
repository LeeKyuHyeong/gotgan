package com.kh.stock.household;

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

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
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

    /** 이미 그 가구의 구성원인 사용자가 초대코드로 다시 합류해도 conflict 가 아니라
     *  그 가구 정보를 그대로 돌려줘야(멱등) 프런트가 메인으로 들어갈 수 있다.
     *  (초대 랜딩이 로그인 사용자를 항상 합류 폼으로 보내므로, 한 번 합류한 사람·가족장 본인이
     *   초대링크/코드를 다시 쓰면 "이미 구성원" 에러에 영구히 갇히던 버그를 막는다.) */
    @Test
    void join_whenAlreadyMember_isIdempotent() {
        Household household = new Household();
        household.setId(7L);
        household.setName("우리집");
        household.setMaxMembers(4);
        household.setInviteCode("K7M3PQ");

        Membership existing = new Membership();
        existing.setHousehold(household);
        existing.setRole(MembershipRole.OWNER);

        when(householdRepository.findByInviteCode("K7M3PQ")).thenReturn(Optional.of(household));
        when(membershipRepository.findByUserIdAndHouseholdId(1L, 7L)).thenReturn(Optional.of(existing));
        when(membershipRepository.countByHouseholdId(7L)).thenReturn(2L);

        HouseholdResponse res = service.join(1L, new JoinHouseholdRequest("K7M3PQ"));

        assertThat(res.id()).isEqualTo(7L);
        assertThat(res.myRole()).isEqualTo(MembershipRole.OWNER);
        assertThat(res.memberCount()).isEqualTo(2);
        // 이미 멤버이므로 새 멤버십을 만들면 안 된다.
        verify(membershipRepository, never()).save(any());
    }
}
