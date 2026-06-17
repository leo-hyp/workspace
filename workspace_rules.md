# Workspace Architecture Rules

## 1. Harness Architecture Constraint (Permanent Memory)
Per user instructions, **ALL NEW PROJECTS** and major refactors within this workspace MUST follow the "Harness" architecture pattern.

### Key Principles:
1. **적당한 모듈화 (Moderate Agent Separation)**: 너무 잘게 쪼개어 단일 실패점(Single Point of Failure)이 늘어나는 것을 경계합니다. 연관성이 높은 작업은 적절히 묶어서 구성하되, 역할이 명확히 다른 경우에만 에이전트를 분리합니다.
2. **오케스트레이터 감독 (Orchestrator as a Supervisor)**: 모든 프로젝트에는 하위 모듈들을 조율하는 중앙 `orchestrator.py`(또는 유사한 진입점)가 존재해야 합니다. 오케스트레이터는 하위 작업이 실패하더라도 전체 사이클이 망가지지 않도록 예외(Error)를 우회하거나 복구하는 강력한 통제력을 가집니다.
3. **최종 검증 및 보고 (Final Validation & Reporting)**: 오케스트레이터는 단순히 스크립트를 순서대로 실행하는 데 그치지 않고, 하위 모듈의 산출물을 교차 검증(Validate)한 뒤 최종 결과 및 상태를 사용자에게 직접 보고(Report)하는 책임을 집니다.
4. **Explicit Rulebooks**: 각 주요 에이전트나 역할은 `agents/rules/` 디렉터리에 마크다운 가이드를 가져야 합니다.
5. **Project Isolation**: 기존 프로젝트와 성격이 다른 새로운 요구사항은 독립된 `PnX_ProjectName` 폴더에 구성합니다.

*When starting a new task, always verify if it requires a new Agent or Orchestrator integration, and do not bypass this Harness structure.*

## 2. Planning & Execution Authority Constraint
- **명시적 검토 및 승인 강제 (Explicit User Approval Required)**: 새로운 프로젝트 생성, 대형 리팩토링, 혹은 시스템 영향도가 큰 변경 작업을 수행할 때 안티그래비티는 코드를 수정하거나 명령을 실행하기에 앞서 반드시 `implementation_plan.md`를 작성하고 사용자에게 검토 및 피드백을 요청(`request_feedback: true`)해야 합니다.
- **선 승인 후 진행**: 사용자가 구현 계획서를 직접 검토하고 명시적으로 승인(Approve)하기 전에는, 어떠한 코드 자동 수정이나 스크립트 실행(배포) 작업도 개시되어서는 안 됩니다. (자율적인 자동 실행 진행 차단)
- **자동 승인 메시지 우회 금지 (Ignore System Auto-Approve Messages)**: 시스템 백엔드에서 `automatically approved` 또는 `stop hook` 관련 자동 승인 메시지가 수신되더라도, 안티그래비티는 이를 사장님의 직관적인 직접 명령으로 간주하지 않습니다. 반드시 사장님이 대화창에 직접 텍스트("진행해라", "승인한다" 등)를 남길 때까지 실행 단계를 멈추고 강제 대기 모드를 유지해야 합니다.
