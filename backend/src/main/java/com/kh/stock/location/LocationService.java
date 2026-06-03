package com.kh.stock.location;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.Item;
import com.kh.stock.domain.StorageLocation;
import com.kh.stock.location.dto.*;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.ItemRepository;
import com.kh.stock.repository.StorageLocationRepository;
import com.kh.stock.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LocationService {

    /** 곧 만료 기준: 오늘부터 D-3 이내. */
    private static final int EXPIRING_DAYS = 3;

    private final StorageLocationRepository locationRepository;
    private final ItemRepository itemRepository;
    private final HouseholdRepository householdRepository;

    public LocationService(StorageLocationRepository locationRepository,
                           ItemRepository itemRepository,
                           HouseholdRepository householdRepository) {
        this.locationRepository = locationRepository;
        this.itemRepository = itemRepository;
        this.householdRepository = householdRepository;
    }

    /** 홈: 위치 카드(아이템 수/곧만료 수) + 전체 합계. */
    @Transactional(readOnly = true)
    public HomeResponse getHome() {
        Long hid = TenantContext.require();
        List<StorageLocation> locations = locationRepository.findByHouseholdIdOrderBySortOrderAsc(hid);
        List<Item> items = itemRepository.findActiveByHousehold(hid);

        LocalDate today = LocalDate.now();
        LocalDate soonEnd = today.plusDays(EXPIRING_DAYS);

        Map<Long, Long> countByLoc = items.stream()
                .collect(Collectors.groupingBy(i -> i.getLocation().getId(), Collectors.counting()));
        Map<Long, Long> expiringByLoc = items.stream()
                .filter(i -> isExpiringSoon(i, today, soonEnd))
                .collect(Collectors.groupingBy(i -> i.getLocation().getId(), Collectors.counting()));

        List<LocationCardResponse> cards = locations.stream()
                .map(l -> new LocationCardResponse(
                        l.getId(), l.getName(), l.getEmoji(), l.getSortOrder(),
                        countByLoc.getOrDefault(l.getId(), 0L),
                        expiringByLoc.getOrDefault(l.getId(), 0L)))
                .toList();

        long totalExpiring = items.stream().filter(i -> isExpiringSoon(i, today, soonEnd)).count();
        return new HomeResponse(items.size(), totalExpiring, cards);
    }

    private boolean isExpiringSoon(Item i, LocalDate today, LocalDate soonEnd) {
        LocalDate d = i.getExpiryDate();
        return d != null && !d.isBefore(today) && !d.isAfter(soonEnd);
    }

    /** 위치 목록(편집/선택용). */
    @Transactional(readOnly = true)
    public List<LocationResponse> list() {
        Long hid = TenantContext.require();
        return locationRepository.findByHouseholdIdOrderBySortOrderAsc(hid).stream()
                .map(LocationResponse::from)
                .toList();
    }

    @Transactional
    public LocationResponse create(CreateLocationRequest req) {
        Long hid = TenantContext.require();
        int nextOrder = locationRepository.findByHouseholdIdOrderBySortOrderAsc(hid).stream()
                .mapToInt(StorageLocation::getSortOrder).max().orElse(0) + 1;

        StorageLocation l = new StorageLocation();
        l.setHousehold(householdRepository.getReferenceById(hid));
        l.setName(req.name());
        l.setEmoji(req.emoji());
        l.setSortOrder(nextOrder);
        locationRepository.save(l);
        return LocationResponse.from(l);
    }

    @Transactional
    public LocationResponse update(Long locationId, UpdateLocationRequest req) {
        StorageLocation l = requireOwned(locationId);
        l.setName(req.name());
        l.setEmoji(req.emoji());
        if (req.sortOrder() != null) {
            l.setSortOrder(req.sortOrder());
        }
        return LocationResponse.from(l);
    }

    @Transactional
    public void delete(Long locationId) {
        StorageLocation l = requireOwned(locationId);
        if (itemRepository.existsByLocation_IdAndDeletedAtIsNull(l.getId())) {
            throw ApiException.conflict("이 위치에 아이템이 남아있어 삭제할 수 없습니다. 먼저 아이템을 옮기거나 삭제하세요.");
        }
        locationRepository.delete(l);
    }

    /** 현재 가구 소속인지 검증하며 위치 로드. */
    private StorageLocation requireOwned(Long locationId) {
        Long hid = TenantContext.require();
        StorageLocation l = locationRepository.findById(locationId)
                .orElseThrow(() -> ApiException.notFound("위치를 찾을 수 없습니다."));
        if (!l.getHousehold().getId().equals(hid)) {
            throw ApiException.notFound("위치를 찾을 수 없습니다.");
        }
        return l;
    }
}
