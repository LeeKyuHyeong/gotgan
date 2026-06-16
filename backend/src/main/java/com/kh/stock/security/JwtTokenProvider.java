package com.kh.stock.security;

import com.kh.stock.config.AppProperties;
import com.kh.stock.domain.type.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/** 자체 JWT(HS256) 발급/검증. subject=userId, claim role. */
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long validitySeconds;

    public JwtTokenProvider(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(props.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.validitySeconds = props.jwt().accessTokenValiditySeconds();
    }

    public String createAccessToken(Long userId, UserRole role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(validitySeconds)))
                .signWith(key)
                .compact();
    }

    /**
     * 서명·만료가 유효하면 userId, 아니면 null.
     * role 은 토큰 claim 이 아니라 필터가 DB 에서 live 로 해석한다(부여/강등 즉시 반영).
     */
    public Long parseUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Long.valueOf(claims.getSubject());
        } catch (Exception e) {
            return null;
        }
    }

    public long getValiditySeconds() {
        return validitySeconds;
    }
}
