package com.kh.stock.push;

import com.kh.stock.config.AppProperties;
import com.kh.stock.domain.PushSubscription;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Security;

/** Web Push 실제 발송 (VAPID). 페이로드 암호화/JWT 서명은 web-push 라이브러리 담당. */
@Service
public class WebPushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    static {
        // ECDH/ECDSA 에 BouncyCastle 필요. 중복 등록은 no-op.
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private final AppProperties props;
    private volatile PushService pushService;

    public WebPushSender(AppProperties props) {
        this.props = props;
    }

    public boolean isConfigured() {
        var p = props.push();
        return p != null && p.vapidPublicKey() != null && !p.vapidPublicKey().isBlank()
                && p.vapidPrivateKey() != null && !p.vapidPrivateKey().isBlank();
    }

    /**
     * 한 구독에 페이로드(JSON) 발송.
     * @return false = 죽은 구독(404/410, 브라우저에서 구독 해지됨) — 호출측이 DB에서 삭제할 것.
     */
    public boolean send(PushSubscription sub, String payloadJson) {
        try {
            Notification notification = new Notification(
                    sub.getEndpoint(), sub.getP256dh(), sub.getAuth(),
                    payloadJson.getBytes(StandardCharsets.UTF_8));
            HttpResponse response = service().send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                return false;
            }
            if (status >= 400) {
                log.warn("푸시 발송 실패 status={} userId={}", status, sub.getUserId());
            }
            return true;
        } catch (Exception e) {
            // 네트워크 등 일시 오류일 수 있으니 구독은 유지
            log.warn("푸시 발송 오류 userId={}: {}", sub.getUserId(), e.getMessage());
            return true;
        }
    }

    private PushService service() throws GeneralSecurityException {
        PushService s = pushService;
        if (s == null) {
            synchronized (this) {
                if (pushService == null) {
                    pushService = new PushService(
                            props.push().vapidPublicKey(),
                            props.push().vapidPrivateKey(),
                            props.push().subject());
                }
                s = pushService;
            }
        }
        return s;
    }
}
