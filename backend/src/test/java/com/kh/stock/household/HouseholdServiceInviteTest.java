package com.kh.stock.household;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.AppUser;
import com.kh.stock.domain.Household;
import com.kh.stock.domain.Membership;
import com.kh.stock.domain.type.MembershipRole;
import com.kh.stock.household.dto.InviteResponse;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HouseholdServiceInviteTest {

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

    private Membership owner(Household h) {
        AppUser u = new AppUser();
        u.setId(1L);
        u.setNickname("현규");
        Membership m = new Membership();
        m.setUser(u);
        m.setHousehold(h);
        m.setRole(MembershipRole.OWNER);
        return m;
    }

    /** (C-1) 동시 재발급으로 코드가 겹치면(UNIQUE 위반) 500 이 아니라 재시도 가능한 409. */
    @Test
    void regenerateInvite_onCodeCollision_throwsConflict() {
        Household h = new Household();
        h.setId(7L);
        h.setMaxMembers(4);
        when(membershipRepository.findByUserIdAndHouseholdId(1L, 7L)).thenReturn(Optional.of(owner(h)));
        when(inviteCodeGenerator.generate()).thenReturn("K7M3PQ");
        when(householdRepository.existsByInviteCode("K7M3PQ")).thenReturn(false);
        when(householdRepository.saveAndFlush(h)).thenThrow(new DataIntegrityViolationException("dup"));

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> service.regenerateInvite(1L, 7L));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    /** 정상 재발급은 새 코드를 반환. */
    @Test
    void regenerateInvite_success_returnsNewCode() {
        Household h = new Household();
        h.setId(7L);
        h.setMaxMembers(4);
        Membership ownerM = owner(h);
        when(membershipRepository.findByUserIdAndHouseholdId(1L, 7L)).thenReturn(Optional.of(ownerM));
        when(inviteCodeGenerator.generate()).thenReturn("K7M3PQ");
        when(householdRepository.existsByInviteCode("K7M3PQ")).thenReturn(false);
        when(householdRepository.saveAndFlush(h)).thenReturn(h);
        when(membershipRepository.findByHouseholdId(7L)).thenReturn(List.of(ownerM));

        InviteResponse res = service.regenerateInvite(1L, 7L);

        assertThat(res.inviteCode()).isEqualTo("K7M3PQ");
        assertThat(res.memberCount()).isEqualTo(1);
    }
}
