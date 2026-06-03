package com.kh.stock.domain.type;

/** 아이템 변동 이력 종류. INCREASE/DECREASE는 수량 변경(delta 사용). */
public enum ItemAction {
    CREATE,
    INCREASE,
    DECREASE,
    UPDATE,
    DELETE
}
