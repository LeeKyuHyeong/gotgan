package com.kh.stock.push;

import com.kh.stock.domain.Household;
import com.kh.stock.domain.Stock;
import com.kh.stock.domain.PushSubscription;
import com.kh.stock.repository.StockRepository;
import com.kh.stock.repository.MembershipRepository;
import com.kh.stock.repository.PushSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 매일 아침 9시(KST) — 가구별 곧만료(D-3 이내) 아이템 요약을 구독 기기 전부에 푸시.
 * 기준은 홈 배지와 동일(LocationService EXPIRING_DAYS=3, 오늘 포함).
 */
@Component
public class ExpiryPushScheduler {

    private static final Logger log = LoggerFactory.getLogger(ExpiryPushScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int EXPIRING_DAYS = 3;
    private static final int MAX_NAMES_IN_BODY = 3;

    private final StockRepository stockRepository;
    private final MembershipRepository membershipRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;

    public ExpiryPushScheduler(StockRepository stockRepository,
                               MembershipRepository membershipRepository,
                               PushSubscriptionRepository subscriptionRepository,
                               WebPushSender sender) {
        this.stockRepository = stockRepository;
        this.membershipRepository = membershipRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.sender = sender;
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    @Transactional
    public void notifyExpiring() {
        if (!sender.isConfigured()) {
            log.info("곧만료 푸시 스킵 — VAPID 키 미설정");
            return;
        }
        LocalDate today = LocalDate.now(KST);
        List<Stock> items = stockRepository.findAllExpiringForNotify(today, today.plusDays(EXPIRING_DAYS));
        if (items.isEmpty()) {
            return;
        }

        // 가구별로 묶어 한 가구 = 한 메시지 (멤버의 모든 구독 기기로)
        Map<Household, List<Stock>> byHousehold = items.stream()
                .collect(Collectors.groupingBy(Stock::getHousehold, LinkedHashMap::new, Collectors.toList()));

        int sent = 0;
        int removed = 0;
        for (var entry : byHousehold.entrySet()) {
            Household household = entry.getKey();
            String payload = buildPayload(household, entry.getValue(), today);

            List<Long> memberIds = membershipRepository.findByHouseholdId(household.getId()).stream()
                    .map(m -> m.getUser().getId())
                    .toList();
            for (PushSubscription sub : subscriptionRepository.findByUserIdIn(memberIds)) {
                if (sender.send(sub, payload)) {
                    sent++;
                } else {
                    subscriptionRepository.delete(sub);   // 죽은 구독(404/410) 정리
                    removed++;
                }
            }
        }
        log.info("곧만료 푸시 완료 — 가구 {}곳, 발송 {}건, 죽은 구독 정리 {}건", byHousehold.size(), sent, removed);
    }

    /** 예: 유통기한 임박 4개 — 우유 오늘, 계란 D-1, 두부 D-3 외 1개 */
    private String buildPayload(Household household, List<Stock> items, LocalDate today) {
        String names = items.stream()
                .limit(MAX_NAMES_IN_BODY)
                .map(i -> i.getProduct().getName() + " " + dLabel(today, i.getExpiryDate()))
                .collect(Collectors.joining(", "));
        int rest = items.size() - MAX_NAMES_IN_BODY;
        String body = "유통기한 임박 " + items.size() + "개 — " + names + (rest > 0 ? " 외 " + rest + "개" : "");
        // Boot 4의 Jackson 3 전환으로 ObjectMapper 빈 타입이 유동적 — 3필드 고정 구조라 직접 직렬화
        return "{\"title\":\"" + jsonEscape("🏠 " + household.getName())
                + "\",\"body\":\"" + jsonEscape(body)
                + "\",\"url\":\"/all\"}";   // 전체 화면(임박순 정렬)으로 진입
    }

    private String jsonEscape(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.toString();
    }

    private String dLabel(LocalDate today, LocalDate expiry) {
        long days = ChronoUnit.DAYS.between(today, expiry);
        return days == 0 ? "오늘" : "D-" + days;
    }
}
