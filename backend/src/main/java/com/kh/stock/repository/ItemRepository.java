package com.kh.stock.repository;

import com.kh.stock.domain.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ItemRepository extends JpaRepository<Item, Long> {

    /** 위치 상세: 해당 위치의 활성 아이템(유통기한 임박순, NULL은 뒤로). */
    @Query("""
            select i from Item i
            where i.location.id = :locationId and i.deletedAt is null
            order by case when i.expiryDate is null then 1 else 0 end, i.expiryDate asc
            """)
    List<Item> findActiveByLocation(@Param("locationId") Long locationId);

    /** 전체: 가구의 활성 아이템(유통기한 임박순). */
    @Query("""
            select i from Item i
            where i.household.id = :householdId and i.deletedAt is null
            order by case when i.expiryDate is null then 1 else 0 end, i.expiryDate asc
            """)
    List<Item> findActiveByHousehold(@Param("householdId") Long householdId);

    /** 곧 만료(D-3): expiry_date 가 오늘~오늘+3일 범위인 활성 아이템 수. */
    @Query("""
            select count(i) from Item i
            where i.household.id = :householdId and i.deletedAt is null
              and i.expiryDate between :from and :to
            """)
    long countExpiringSoon(@Param("householdId") Long householdId,
                           @Param("from") LocalDate from,
                           @Param("to") LocalDate to);

    /** 목록/검색 통합: 위치(optional) + 이름검색(optional), 유통기한 임박순(NULL 뒤). */
    @Query("""
            select i from Item i
            where i.household.id = :householdId and i.deletedAt is null
              and (:locationId is null or i.location.id = :locationId)
              and (:q is null or lower(i.name) like lower(concat('%', :q, '%')))
            order by case when i.expiryDate is null then 1 else 0 end, i.expiryDate asc
            """)
    List<Item> search(@Param("householdId") Long householdId,
                      @Param("locationId") Long locationId,
                      @Param("q") String q);

    /** 푸시 알림용: 전 가구의 곧만료(오늘~+3일) 활성 아이템. 가구별로 묶어 발송. */
    @Query("""
            select i from Item i join fetch i.household
            where i.deletedAt is null and i.expiryDate between :from and :to
            order by i.household.id, i.expiryDate asc
            """)
    List<Item> findAllExpiringForNotify(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** 위치 삭제 가드: 해당 위치에 활성 아이템이 있는지. */
    boolean existsByLocation_IdAndDeletedAtIsNull(Long locationId);

    /** 공통 분류 삭제 가드: 이 분류를 사용하는 아이템이 있는지(삭제분 포함). */
    boolean existsByCategory_Id(Long categoryId);

    /** 가구 삭제 시 정리(소프트삭제 무관 전부). */
    void deleteByHousehold_Id(Long householdId);
}
