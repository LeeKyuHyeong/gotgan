package com.kh.stock.household;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/** 초대코드 생성기. 헷갈리는 글자(O/0, I/1, L) 제외한 6자 영숫자. */
@Component
public class InviteCodeGenerator {

    // I, O, L, 0, 1 제외
    private static final char[] ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int LENGTH = 6;

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }
}
