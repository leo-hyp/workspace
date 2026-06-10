# Medi-IT 브리핑 하네스 아키텍처 구성도

새롭게 구축된 **Medi-IT 뉴스 브리핑 하네스**의 전체 시스템 구성도입니다. 윈도우 스케줄러를 기점으로, 중앙의 오케스트레이터가 3명의 전문가 에이전트를 감독하며 파이프라인을 제어하는 **감독자(Supervisor) 패턴**을 띄고 있습니다.

```mermaid
graph TD
    classDef orchestrator fill:#f9d0c4,stroke:#333,stroke-width:2px,color:#000;
    classDef agent fill:#d4e6f1,stroke:#333,stroke-width:1px,color:#000;
    classDef skill fill:#d5f5e3,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5,color:#000;
    classDef external fill:#fcf3cf,stroke:#333,stroke-width:1px,color:#000;
    classDef storage fill:#e8daef,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5,color:#000;

    Trigger[Windows Task Scheduler<br>Medi-IT-Daily-7AM] -->|매일 아침 7시 실행| ORCH

    subgraph "Harness Agent Team (Supervisor Pattern)"
        ORCH((Orchestrator<br>Supervisor Agent)):::orchestrator
        
        A1[News Scraper<br>Agent 1]:::agent
        A2[Content Reviewer<br>Agent 2]:::agent
        A3[Telegram Publisher<br>Agent 3]:::agent

        S1[["skill_fetch_news.py<br>(한글 필터링)"]]:::skill
        S2[["skill_review_content.py<br>(하이브리드 AI)"]]:::skill
        S3[["skill_publish_telegram.py<br>(지수 백오프)"]]:::skill

        ORCH -->|1. 크롤링 지시| A1
        A1 -.->|사용| S1
        S1 -->|반환: 유효 뉴스| A1
        A1 -->|결과 및 에러 보고| ORCH

        ORCH -->|2. 요약 지시| A2
        A2 -.->|사용| S2
        S2 -->|반환: 브리핑 HTML| A2
        A2 -->|결과 보고| ORCH

        ORCH -->|3. 전송 지시| A3
        A3 -.->|사용| S3
        S3 -->|반환: 성공 여부| A3
        A3 -->|상태 보고| ORCH
    end

    subgraph "External / Data Storage"
        RSS[("RSS Feeds<br>(전자신문, 데일리메드 등)")]:::external
        AI[("AI Models<br>(Gemini API / Local Gemma)")]:::external
        TG[("Telegram API<br>(Hos_it_man_bot)")]:::external
        WS[("로컬 _workspace/<br>(JSON & MD 감사 로그)")]:::storage
    end

    S1 -.->|네트워크 요청| RSS
    S2 -.->|프롬프트 전송| AI
    S3 -.->|HTTP POST| TG

    ORCH -.->|단계별 데이터 스냅샷 백업| WS
```

### 아키텍처 핵심 포인트
1. **단일 진입점 통제**: 윈도우 스케줄러는 오직 `orchestrator.py` 하나만 호출하며, 내부 복잡성은 오케스트레이터가 모두 캡슐화하여 관리합니다.
2. **책임 분리 원칙**: 스크래핑 로직에 에러가 나면 `skill_fetch_news.py`만 수정하면 되고, 전송 에러가 나면 `skill_publish_telegram.py`만 수정하면 되는 완벽한 모듈화 구조입니다.
3. **결함 허용(Fault Tolerance)**: 특정 에이전트 작업 중 치명적인 에러(예: 수집 결과 0건)가 발생하면, 오케스트레이터가 즉시 상황을 인지하고 후속 작업을 차단하여 불량한 결과물이 전송되는 것을 미연에 방지합니다.
