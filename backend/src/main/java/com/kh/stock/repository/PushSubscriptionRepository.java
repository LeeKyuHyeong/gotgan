package com.kh.stock.repository;

import com.kh.stock.domain.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    /** 알림 발송용: 가구 멤버들의 모든 구독(기기별 여러 개 가능). */
    List<PushSubscription> findByUserIdIn(Collection<Long> userIds);

    void deleteByEndpointAndUserId(String endpoint, Long userId);
}
