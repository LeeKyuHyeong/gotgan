package com.kh.stock.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** 보관 위치 (가구 범위). 평평한 1단계 구조 + 이모지 + 정렬순서. */
@Entity
@Table(name = "storage_location")
@Getter
@Setter
@NoArgsConstructor
public class StorageLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 16)
    private String emoji;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    /** 소프트삭제 시각. NULL=활성. (소프트삭제된 재고가 FK 로 위치를 붙들어 하드삭제가 막히는 문제 회피) */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
