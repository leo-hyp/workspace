# 📋 2단원: 계획 협업 (Planning Mode)

이 단원에서는 규모가 크거나 리스크가 있는 작업을 진행할 때, 안티그래비티가 어떻게 계획을 세우고 사장님과 조율하며 안전하게 코드를 배포하는지 학습합니다.

---

## 💡 이론: 계획 모드 (Planning Mode)의 필요성

단순한 타이포 수정이 아닌 아키텍처 리팩토링이나 새로운 라이브러리 교체 등의 작업은 계획 없이 돌입했다가 시스템 전체를 망가뜨릴 수 있습니다. 안티그래비티는 이를 방지하기 위해 다음 3단계 구조를 사용합니다.

```
[1단계] 기획 및 리서치 (Research & Design)
       ▼
[2단계] 구현 계획서 생성 (implementation_plan.md) ➡️ 사장님 승인 대기
       ▼
[3단계] 승인 후 실행 (Execution with task.md)
       ▼
[4단계] 완료 검증서 보고 (walkthrough.md)
```

이 방식을 통해 사장님은 코드 한 줄도 바뀌기 전에 안티그래비티가 어떤 설계를 구상했는지 파악하고 피드백을 주실 수 있습니다.

---

## 🎯 실습 미션 2: 레거시 API 안전하게 마이그레이션하기

[mission_planning.py](file:///c:/Users/ismadmin/Documents/Workspace/Pn7_Mastery/chapters/chapter2_planning/mission_planning.py) 파일은 옛날 버전의 함수(`old_query_database`)를 사용하여 인프라 모니터링 데이터를 조회하고 있습니다. 이를 신규 보안 버전 API(`secure_query_database_v2`)로 마이그레이션해야 합니다.

### 📝 미션 수행 방법
1. 대화창에 다음과 같이 명령을 입력합니다:
   > **명령 예시:** `"Pn7_Mastery 2단원의 mission_planning.py를 읽고, 기존 레거시 데이터 조회 함수를 신규 V2 함수로 리팩토링하는 계획을 수립하고 진행해줘."`
2. 안티그래비티가 코드를 리서치한 후, 즉시 코드를 변경하지 않고 **`implementation_plan.md` 아티팩트**를 작성해 사장님께 피드백을 요청하는 흐름을 확인합니다.
3. 계획서를 확인하신 후, 승인(**Approve**) 버튼을 눌러 작업을 개시하도록 허용합니다.
4. 작업이 시작되면 안티그래비티가 **`task.md`**를 만들어 본인의 체크리스트를 marking 해가며 코드를 바꾸고 검증하는 과정을 지켜봅니다.
5. 마지막으로, 변경된 사항과 테스트 통과 결과를 요약한 **`walkthrough.md`**가 생성되고 보고되면 미션이 종료됩니다.

---

## ⏭️ 다음 단계로
계획 모드를 마스터하셨다면, 안티그래비티의 가장 강력한 지능형 도구인 `/grill-me`와 `/goal`을 다루는 3단원으로 이동해 보겠습니다.
* 👉 **[3단원: 자율 주행 (/grill-me & /goal) 바로가기](file:///c:/Users/ismadmin/Documents/Workspace/Pn7_Mastery/chapters/chapter3_slash_commands/README.md)**
