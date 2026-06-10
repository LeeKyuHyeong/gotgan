package com.kh.stock.domain;

import com.kh.stock.domain.type.ItemAction;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 변동 이력 (누가/언제/무엇을). household_id 비정규화로 가구 단위 조회. */
@Entity
@Table(name = "item_history")
@Getter
@Setter
@NoArgsConstructor
public class ItemHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ItemAction action;

    /** 수량 변화량 (+/-). 비수량 액션은 NULL. */
    @Column(precision = 10, scale = 2)
    private BigDecimal delta;

    @Column(name = "quantity_after", precision = 10, scale = 2)
    private BigDecimal quantityAfter;

    /** 당시 아이템 이름 스냅샷 (변경/삭제돼도 이력 가독성 유지). */
    @Column(name = "item_name_snapshot", nullable = false, length = 100)
    private String itemNameSnapshot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
