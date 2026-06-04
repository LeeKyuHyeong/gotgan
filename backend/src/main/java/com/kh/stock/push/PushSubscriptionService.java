package com.kh.stock.push;

import com.kh.stock.domain.PushSubscription;
import com.kh.stock.push.dto.SubscribeRequest;
import com.kh.stock.repository.PushSubscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PushSubscriptionService {

    private final PushSubscriptionRepository repository;

    public PushSubscriptionService(PushSubscriptionRepository repository) {
        this.repository = repository;
    }

    /** endpoint 기준 upsert — 같은 기기 재구독(키 갱신, 계정 전환) 시 덮어쓴다. */
    @Transactional
    public void subscribe(Long userId, SubscribeRequest req) {
        PushSubscription sub = repository.findByEndpoint(req.endpoint()).orElseGet(PushSubscription::new);
        sub.setUserId(userId);
        sub.setEndpoint(req.endpoint());
        sub.setP256dh(req.p256dh());
        sub.setAuth(req.auth());
        repository.save(sub);
    }

    /** 본인 구독만 삭제(타인 endpoint 삭제 방지). 없는 endpoint 는 조용히 무시. */
    @Transactional
    public void unsubscribe(Long userId, String endpoint) {
        repository.deleteByEndpointAndUserId(endpoint, userId);
    }
}
