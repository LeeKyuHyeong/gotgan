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

    /** 유효하면 AuthUser, 아니면 null. */
    public AuthUser parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Long userId = Long.valueOf(claims.getSubject());
            UserRole role = UserRole.valueOf(claims.get("role", String.class));
            return new AuthUser(userId, role);
        } catch (Exception e) {
            return null;
        }
    }

    public long getValiditySeconds() {
        return validitySeconds;
    }
}
