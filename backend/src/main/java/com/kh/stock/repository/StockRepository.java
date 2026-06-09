package com.kh.stock.repository;

import com.kh.stock.domain.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockRepository extends JpaRepository<Stock, Long> {

    /** 위치 상세: 활성 묶음(유통기한 임박순, NULL 뒤). product/location/category fetch. */
    @Query("""
            select s from Stock s
              join fetch s.product p
              left join fetch p.category
              join fetch s.location
            where s.location.id = :locationId and s.deletedAt is null
            order by case when s.expiryDate is null then 1 else 0 end, s.expiryDate asc
            """)
    List<Stock> findActiveByLocation(@Param("locationId") Long locationId);

    /** 전체/홈: 가구의 활성 묶음(유통기한 임박순). product/group/location fetch. */
    @Query("""
            select s from Stock s
              join fetch s.product p
              left join fetch p.group
              left join fetch p.category
              join fetch s.location
            where s.household.id = :householdId and s.deletedAt is null
            order by case when s.expiryDate is null then 1 else 0 end, s.expiryDate asc
            """)
    List<Stock> findActiveByHousehold(@Param("householdId") Long householdId);

    /** 합산 키 매칭(null-safe 유통기한): 같은 (product, location, expiry) 활성 묶음. */
    @Query("""
            select s from Stock s
            where s.product.id = :productId and s.location.id = :locationId
              and s.deletedAt is null
              and ((:expiry is null and s.expiryDate is null) or s.expiryDate = :expiry)
            """)
    Optional<Stock> findActiveMergeTarget(@Param("productId") Long productId,
                                          @Param("locationId") Long locationId,
                                          @Param("expiry") LocalDate expiry);

    /** 되살리기: 같은 키의 소프트삭제 묶음(있으면 재사용). */
    @Query("""
            select s from Stock s
            where s.product.id = :productId and s.location.id = :locationId
              and s.deletedAt is not null
              and ((:expiry is null and s.expiryDate is null) or s.expiryDate = :expiry)
            order by s.deletedAt desc
            """)
    List<Stock> findDeletedMergeCandidates(@Param("productId") Long productId,
                                           @Param("locationId") Long locationId,
                                           @Param("expiry") LocalDate expiry);

    /** product의 활성 묶음 수(product cascade 판단). */
    long countByProduct_IdAndDeletedAtIsNull(Long productId);

    /** 위치 삭제 가드: 활성 묶음 존재 여부. */
    boolean existsByLocation_IdAndDeletedAtIsNull(Long locationId);

    /** 곧만료(D-3) 푸시: 전 가구 활성 묶음. product/household fetch, 가구·임박순. */
    @Query("""
            select s from Stock s
              join fetch s.household
              join fetch s.product
            where s.deletedAt is null and s.expiryDate between :from and :to
            order by s.household.id, s.expiryDate asc
            """)
    List<Stock> findAllExpiringForNotify(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** 단건 + 연관 fetch(응답/이력용). */
    @Query("""
            select s from Stock s
              join fetch s.product p
              left join fetch p.category
              join fetch s.location
            where s.id = :id
            """)
    Optional<Stock> findByIdWithRefs(@Param("id") Long id);

    /** 가구 삭제 정리. */
    void deleteByHousehold_Id(Long householdId);
}
