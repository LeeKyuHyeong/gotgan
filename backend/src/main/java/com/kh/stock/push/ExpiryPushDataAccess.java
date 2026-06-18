package com.kh.stock.push;

import com.kh.stock.domain.Household;
import com.kh.stock.domain.PushSubscription;
import com.kh.stock.domain.Stock;
import com.kh.stock.repository.MembershipRepository;
import com.kh.stock.repository.PushSubscriptionRepository;
import com.kh.stock.repository.StockRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 곧만료 푸시의 DB 접근 전담 빈. 발송(외부 HTTP)은 {@link ExpiryPushScheduler}가 트랜잭션 밖에서 수행한다.
 * <p>스케줄러와 분리한 이유: ① 외부 HTTP를 DB 트랜잭션 안에서 돌리면 느린 제공자가 커넥션을 배치 내내
 * 점유하고, 후속 단계 예외 시 이미 보낸 푸시를 되돌릴 수 없으면서 죽은 구독 정리까지 함께 롤백된다.
 * ② {@code @Transactional} 자기호출(self-invocation)은 프록시를 우회해 무효가 되므로 별도 빈이어야 한다.
 */
@Component
public class ExpiryPushDataAccess {

    private static final int MAX_NAMES_IN_BODY = 3;

    private final StockRepository stockRepository;
    private final MembershipRepository membershipRepository;
    private final PushSubscriptionRepository subscriptionRepository;

    public ExpiryPushDataAccess(StockRepository stockRepository,
                                MembershipRepository membershipRepository,
                                PushSubscriptionRepository subscriptionRepository) {
        this.stockRepository = stockRepository;
        this.membershipRepository = membershipRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    /** 발송 1건 = 한 구독 기기 + 그 가구의 페이로드. 발송은 트랜잭션 밖에서. */
    public record SendTask(PushSubscription subscription, String payload) {}

    /**
     * 곧만료 아이템을 가구별로 묶어 가구당 메시지를 만들고, 멤버들의 모든 구독 기기로 보낼 작업 목록을 만든다.
     * lazy 연관(product/household 이름)을 여기서 모두 읽어 두므로 반환된 엔티티는 detach 되어도
     * 발송 측에서 단순 컬럼(endpoint/key/userId)만 읽는 한 안전하다.
     */
    @Transactional(readOnly = true)
    public List<SendTask> collectSendTasks(LocalDate today, LocalDate until) {
        List<Stock> items = stockRepository.findAllExpiringForNotify(today, until);
        if (items.isEmpty()) {
            return List.of();
        }

        Map<Household, List<Stock>> byHousehold = items.stream()
                .collect(Collectors.groupingBy(Stock::getHousehold, LinkedHashMap::new, Collectors.toList()));

        List<SendTask> tasks = new ArrayList<>();
        for (var entry : byHousehold.entrySet()) {
            Household household = entry.getKey();
            String payload = buildPayload(household, entry.getValue(), today);

            List<Long> memberIds = membershipRepository.findByHouseholdId(household.getId()).stream()
                    .map(m -> m.getUser().getId())
                    .toList();
            for (PushSubscription sub : subscriptionRepository.findByUserIdIn(memberIds)) {
                tasks.add(new SendTask(sub, payload));
            }
        }
        return tasks;
    }

    /** 죽은 구독(404/410) 일괄 정리 — 발송과 분리된 짧은 트랜잭션. */
    @Transactional
    public void removeDeadSubscriptions(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return;
        }
        subscriptionRepository.deleteAllById(ids);
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
        long days = java.time.temporal.ChronoUnit.DAYS.between(today, expiry);
        return days == 0 ? "오늘" : "D-" + days;
    }
}
