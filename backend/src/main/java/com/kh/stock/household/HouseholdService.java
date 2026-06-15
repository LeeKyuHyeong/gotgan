package com.kh.stock.household;

import com.kh.stock.auth.dto.UserDto;
import com.kh.stock.common.ApiException;
import com.kh.stock.domain.*;
import com.kh.stock.domain.type.MembershipRole;
import com.kh.stock.household.dto.*;
import com.kh.stock.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class HouseholdService {

    /** 새 가구 생성 시 자동으로 만드는 기본 위치. */
    private static final List<String[]> DEFAULT_LOCATIONS = List.of(
            new String[]{"큰방", "🏠"},
            new String[]{"화장실", "🚿"},
            new String[]{"냉장고", "🧊"},
            new String[]{"거실", "🛋"}
    );

    private final HouseholdRepository householdRepository;
    private final MembershipRepository membershipRepository;
    private final StorageLocationRepository locationRepository;
    private final AppUserRepository userRepository;
    private final StockRepository stockRepository;
    private final ProductRepository productRepository;
    private final ProductGroupRepository groupRepository;
    private final ItemHistoryRepository itemHistoryRepository;
    private final CategoryRequestRepository categoryRequestRepository;
    private final InviteCodeGenerator inviteCodeGenerator;

    public HouseholdService(HouseholdRepository householdRepository,
                            MembershipRepository membershipRepository,
                            StorageLocationRepository locationRepository,
                            AppUserRepository userRepository,
                            StockRepository stockRepository,
                            ProductRepository productRepository,
                            ProductGroupRepository groupRepository,
                            ItemHistoryRepository itemHistoryRepository,
                            CategoryRequestRepository categoryRequestRepository,
                            InviteCodeGenerator inviteCodeGenerator) {
        this.householdRepository = householdRepository;
        this.membershipRepository = membershipRepository;
        this.locationRepository = locationRepository;
        this.userRepository = userRepository;
        this.stockRepository = stockRepository;
        this.productRepository = productRepository;
        this.groupRepository = groupRepository;
        this.itemHistoryRepository = itemHistoryRepository;
        this.categoryRequestRepository = categoryRequestRepository;
        this.inviteCodeGenerator = inviteCodeGenerator;
    }

    @Transactional(readOnly = true)
    public MeResponse getMe(Long userId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("사용자를 찾을 수 없습니다."));
        return buildMe(user);
    }

    /** 표시 이름(닉네임) 변경 — 카카오 닉네임이 null로 들어오는 경우 등. */
    @Transactional
    public MeResponse updateDisplayName(Long userId, String nickname) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("사용자를 찾을 수 없습니다."));
        user.setNickname(nickname.trim());
        return buildMe(user);
    }

    private MeResponse buildMe(AppUser user) {
        List<HouseholdSummary> households = membershipRepository.findByUserId(user.getId()).stream()
                .map(HouseholdSummary::from)
                .toList();
        return new MeResponse(UserDto.from(user), households, households.isEmpty());
    }

    /** 새 가구 만들기: 가구 + 가족장 멤버십 + 기본 위치 4개 + 초대코드. */
    @Transactional
    public HouseholdResponse create(Long userId, CreateHouseholdRequest req) {
        AppUser owner = userRepository.getReferenceById(userId);

        Household household = new Household();
        household.setName(req.name());
        household.setOwner(owner);
        household.setInviteCode(generateUniqueCode());
        householdRepository.save(household);

        Membership ownerMembership = new Membership();
        ownerMembership.setUser(owner);
        ownerMembership.setHousehold(household);
        ownerMembership.setRole(MembershipRole.OWNER);
        membershipRepository.save(ownerMembership);

        int order = 1;
        for (String[] loc : DEFAULT_LOCATIONS) {
            StorageLocation l = new StorageLocation();
            l.setHousehold(household);
            l.setName(loc[0]);
            l.setEmoji(loc[1]);
            l.setSortOrder(order++);
            locationRepository.save(l);
        }

        return new HouseholdResponse(
                household.getId(), household.getName(), MembershipRole.OWNER,
                household.getInviteCode(), 1, household.getMaxMembers());
    }

    /** 초대코드로 합류 (인원 상한 체크). 이미 구성원이면 멱등 — 에러 대신 그 가구를 돌려준다. */
    @Transactional
    public HouseholdResponse join(Long userId, JoinHouseholdRequest req) {
        Household household = householdRepository.findByInviteCode(req.inviteCode().trim())
                .orElseThrow(() -> ApiException.notFound("초대코드가 올바르지 않습니다."));

        long count = membershipRepository.countByHouseholdId(household.getId());

        // 이미 구성원이면 멱등 처리 — conflict 로 막지 않고 그 가구 정보를 그대로 돌려준다.
        // (초대 랜딩이 로그인 사용자를 항상 합류 폼으로 보내므로, 한 번 합류한 사람·가족장 본인이
        //  초대링크/코드를 다시 쓸 때 "이미 구성원" 에러에 갇혀 메인으로 못 가던 버그를 막는다.)
        Optional<Membership> existing = membershipRepository.findByUserIdAndHouseholdId(userId, household.getId());
        if (existing.isPresent()) {
            return new HouseholdResponse(
                    household.getId(), household.getName(), existing.get().getRole(),
                    null, (int) count, household.getMaxMembers());
        }

        if (count >= household.getMaxMembers()) {
            throw ApiException.conflict("가구 인원이 가득 찼습니다.");
        }

        Membership membership = new Membership();
        membership.setUser(userRepository.getReferenceById(userId));
        membership.setHousehold(household);
        membership.setRole(MembershipRole.MEMBER);
        membershipRepository.save(membership);

        return new HouseholdResponse(
                household.getId(), household.getName(), MembershipRole.MEMBER,
                null, (int) count + 1, household.getMaxMembers());
    }

    /** 초대 화면(가족장 전용): 코드 + 멤버 현황. */
    @Transactional(readOnly = true)
    public InviteResponse getInvite(Long userId, Long householdId) {
        Household household = requireOwner(userId, householdId);
        return buildInvite(household);
    }

    /** 초대코드 재발급(가족장 전용). */
    @Transactional
    public InviteResponse regenerateInvite(Long userId, Long householdId) {
        Household household = requireOwner(userId, householdId);
        household.setInviteCode(generateUniqueCode());
        return buildInvite(household);
    }

    private InviteResponse buildInvite(Household household) {
        List<Membership> members = membershipRepository.findByHouseholdId(household.getId());
        return new InviteResponse(
                household.getInviteCode(),
                members.size(),
                household.getMaxMembers(),
                members.stream().map(MemberResponse::from).toList());
    }

    // ---------- 가구 관리 ----------

    /** 가구 상세(구성원 누구나). 초대코드는 가족장에게만 노출. */
    @Transactional(readOnly = true)
    public HouseholdDetailResponse getDetail(Long userId, Long householdId) {
        Membership my = requireMember(userId, householdId);
        Household h = my.getHousehold();
        List<Membership> members = membershipRepository.findByHouseholdId(householdId);
        boolean owner = my.getRole() == MembershipRole.OWNER;
        return new HouseholdDetailResponse(
                h.getId(), h.getName(), my.getRole(),
                owner ? h.getInviteCode() : null,
                h.getOwner().getId(),
                members.size(), h.getMaxMembers(),
                members.stream().map(MemberResponse::from).toList());
    }

    /** 가구 이름 변경(가족장). */
    @Transactional
    public HouseholdDetailResponse rename(Long userId, Long householdId, RenameHouseholdRequest req) {
        Household h = requireOwner(userId, householdId);
        h.setName(req.name().trim());
        return getDetail(userId, householdId);
    }

    /** 멤버 내보내기(가족장). 가족장 자신/존재하지 않는 멤버는 거부. */
    @Transactional
    public void kickMember(Long ownerId, Long householdId, Long targetUserId) {
        requireOwner(ownerId, householdId);
        if (targetUserId.equals(ownerId)) {
            throw ApiException.badRequest("가족장은 자신을 내보낼 수 없습니다.");
        }
        Membership target = membershipRepository.findByUserIdAndHouseholdId(targetUserId, householdId)
                .orElseThrow(() -> ApiException.notFound("해당 가구의 구성원이 아닙니다."));
        membershipRepository.delete(target);
    }

    /** 가족장 넘기기(소유권 이양). 대상은 현재 가구 멤버여야 함. */
    @Transactional
    public HouseholdDetailResponse transferOwnership(Long ownerId, Long householdId, TransferOwnershipRequest req) {
        Household h = requireOwner(ownerId, householdId);
        Long targetId = req.userId();
        if (targetId.equals(ownerId)) {
            throw ApiException.badRequest("이미 가족장입니다.");
        }
        Membership target = membershipRepository.findByUserIdAndHouseholdId(targetId, householdId)
                .orElseThrow(() -> ApiException.notFound("해당 가구의 구성원이 아닙니다."));
        Membership current = membershipRepository.findByUserIdAndHouseholdId(ownerId, householdId)
                .orElseThrow(() -> ApiException.forbidden("권한이 없습니다."));

        h.setOwner(target.getUser());
        target.setRole(MembershipRole.OWNER);
        current.setRole(MembershipRole.MEMBER);
        return getDetail(ownerId, householdId);
    }

    /** 가구 나가기(멤버). 가족장은 불가(이양/삭제 먼저). */
    @Transactional
    public void leave(Long userId, Long householdId) {
        Membership my = requireMember(userId, householdId);
        if (my.getRole() == MembershipRole.OWNER) {
            throw ApiException.badRequest("가족장은 나갈 수 없습니다. 소유권을 넘기거나 가구를 삭제하세요.");
        }
        membershipRepository.delete(my);
    }

    /** 가구 삭제(가족장). 재고·품목·그룹·이력·위치·분류요청·멤버십까지 정리. 되돌릴 수 없음. */
    @Transactional
    public void delete(Long userId, Long householdId) {
        Household h = requireOwner(userId, householdId);
        itemHistoryRepository.deleteByHouseholdId(householdId);   // FK → stock
        stockRepository.deleteByHousehold_Id(householdId);        // FK → product
        productRepository.deleteByHousehold_Id(householdId);      // FK → product_group
        groupRepository.deleteByHousehold_Id(householdId);
        locationRepository.deleteByHouseholdId(householdId);
        categoryRequestRepository.deleteByHousehold_Id(householdId);
        membershipRepository.deleteByHouseholdId(householdId);
        householdRepository.delete(h);  // item_legacy 는 DB FK CASCADE 로 함께 정리
    }

    private Membership requireMember(Long userId, Long householdId) {
        return membershipRepository.findByUserIdAndHouseholdId(userId, householdId)
                .orElseThrow(() -> ApiException.forbidden("해당 가구의 구성원이 아닙니다."));
    }

    private Household requireOwner(Long userId, Long householdId) {
        Membership membership = requireMember(userId, householdId);
        if (membership.getRole() != MembershipRole.OWNER) {
            throw ApiException.forbidden("가족장만 할 수 있습니다.");
        }
        return membership.getHousehold();
    }

    private String generateUniqueCode() {
        String code;
        do {
            code = inviteCodeGenerator.generate();
        } while (householdRepository.existsByInviteCode(code));
        return code;
    }
}
