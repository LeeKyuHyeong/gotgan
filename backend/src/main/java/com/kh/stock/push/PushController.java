package com.kh.stock.push;

import com.kh.stock.config.AppProperties;
import com.kh.stock.push.dto.SubscribeRequest;
import com.kh.stock.push.dto.UnsubscribeRequest;
import com.kh.stock.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Web Push 구독 관리. 사용자 단위(가구 헤더 불필요). */
@RestController
@RequestMapping("/api/push")
public class PushController {

    private final AppProperties props;
    private final PushSubscriptionService service;

    public PushController(AppProperties props, PushSubscriptionService service) {
        this.props = props;
        this.service = service;
    }

    /** 프론트가 pushManager.subscribe 에 쓸 VAPID 공개키. */
    @GetMapping("/vapid-public-key")
    public Map<String, String> vapidPublicKey() {
        return Map.of("publicKey", props.push().vapidPublicKey());
    }

    @PostMapping("/subscriptions")
    public void subscribe(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody SubscribeRequest req) {
        service.subscribe(user.id(), req);
    }

    @DeleteMapping("/subscriptions")
    public void unsubscribe(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody UnsubscribeRequest req) {
        service.unsubscribe(user.id(), req.endpoint());
    }
}
