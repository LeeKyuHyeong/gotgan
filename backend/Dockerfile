# --- build stage: Gradle 래퍼로 bootJar 생성 (Java 17) ---
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# 의존성 레이어 캐시: 래퍼/빌드스크립트 먼저 복사
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

# 소스 복사 후 빌드 (테스트는 DB 필요하므로 제외)
COPY src ./src
RUN ./gradlew --no-daemon clean bootJar -x test

# --- runtime stage: JRE만 ---
FROM eclipse-temurin:17-jre
WORKDIR /app

# 비루트 사용자로 실행
RUN useradd -r -u 1001 spring
USER spring

COPY --from=build /app/build/libs/*-SNAPSHOT.jar app.jar

EXPOSE 8083
# 운영 프로파일은 docker-compose 의 SPRING_PROFILES_ACTIVE 로 주입
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
