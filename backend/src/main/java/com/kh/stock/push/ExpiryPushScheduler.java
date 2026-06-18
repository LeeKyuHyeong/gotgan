package com.kh.stock.push;

import com.kh.stock.push.ExpiryPushDataAccess.SendTask;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * 매일 아침 9시(KST) — 가구별 곧만료(D-3 이내) 아이템 요약을 구독 기기 전부에 푸시.
 * 기준은 홈 배지와 동일(LocationService EXPIRING_DAYS=3, 오늘 포함).
 * <p>DB 접근/페이로드 빌드는 {@link ExpiryPushDataAccess}(트랜잭션)가, 외부 HTTP 발송은 여기서
 * 트랜잭션 밖에서 수행한다 — 느린 제공자가 DB 커넥션을 점유하거나, 후속 예외가 이미 보낸 푸시와
 * 죽은 구독 정리를 함께 롤백하는 일을 막기 위함.
 */
@Component
public class ExpiryPushScheduler {

    private static final Logger log = LoggerFactory.getLogger(ExpiryPushScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int EXPIRING_DAYS = 3;

    private final ExpiryPushDataAccess data;
    private final WebPushSender sender;

    public ExpiryPushScheduler(ExpiryPushDataAccess data, WebPushSender sender) {
        this.data = data;
        this.sender = sender;
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void notifyExpiring() {
        if (!sender.isConfigured()) {
            log.info("곧만료 푸시 스킵 — VAPID 키 미설정");
            return;
        }
        LocalDate today = LocalDate.now(KST);
        List<SendTask> tasks = data.collectSendTasks(today, today.plusDays(EXPIRING_DAYS));
        if (tasks.isEmpty()) {
            return;
        }

        // 외부 HTTP — 트랜잭션 밖. 죽은 구독은 id만 모았다가 별도 짧은 트랜잭션에서 정리.
        int sent = 0;
        List<Long> deadIds = new ArrayList<>();
        for (SendTask t : tasks) {
            if (sender.send(t.subscription(), t.payload())) {
                sent++;
            } else {
                deadIds.add(t.subscription().getId());
            }
        }
        data.removeDeadSubscriptions(deadIds);
        log.info("곧만료 푸시 완료 — 발송 {}건, 죽은 구독 정리 {}건", sent, deadIds.size());
    }
}
