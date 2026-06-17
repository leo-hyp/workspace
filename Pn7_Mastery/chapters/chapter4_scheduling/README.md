# ⏰ 4단원: 예약 배치 (/schedule)

이 단원에서는 안티그래비티에게 주기적으로 모니터링 작업을 맡기거나, 백그라운드 작업이 끝날 때까지 1회성 타이머를 세팅하여 알림을 받는 `/schedule` 기능을 학습합니다.

---

## 💡 이론: `/schedule` (타이머 및 크론 스케줄링)

안티그래비티의 `/schedule` 명령어는 두 가지 모드를 지원합니다.

1. **One-shot timer (1회성 타이머)**
   * **사용 목적:** 무거운 빌드나 오랜 크롤링을 실행해 두고 자리를 비울 때, 완료 시각에 맞춰 에이전트가 깨어나 확인해 주길 바랄 때 사용합니다.
   * **사용 예시:** `/schedule DurationSeconds=60, Prompt="Chapter 4 스크립트 실행 결과를 확인하고 보고해줘."`
   * **특징:** 타이머 설정 초(Seconds) 이후에 에이전트에게 지정된 `Prompt`로 호출이 도달해 백그라운드에서 복귀합니다.

2. **Recurring cron (주기적 반복 실행)**
   * **사용 목적:** 5분마다 헬스체크를 돌리거나, 매일 특정 시간에 뉴스레터를 수집해 텔레그램으로 쏠 때 사용합니다.
   * **사용 예시:** `/schedule CronExpression="*/10 * * * *", MaxIterations=3, Prompt="서버 상태 체크 스크립트를 돌려줘."`
   * **특징:** 크론 표현식(`* * * * *`)에 맞추어 에이전트가 백그라운드 배치 프로세스로 깨어나 지정된 명령을 완수합니다.

---

## 🎯 실습 미션 4: 배치 예약 리포팅 가동

이 폴더에 있는 [mission_cron.py](file:///c:/Users/ismadmin/Documents/Workspace/Pn7_Mastery/chapters/chapter4_scheduling/mission_cron.py)는 실행 시 현재 시각과 인프라 요약을 파일로 내보내는 봇 스크립트입니다.

### 📝 미션 수행 방법
1. 대화창에 `/schedule` 명령어를 사용해 30초 뒤에 안티그래비티가 깨어나 `mission_cron.py`를 실행하도록 예약을 걸어봅니다.
   > **명령 예약 예시:** `/schedule DurationSeconds=30, Prompt="Pn7_Mastery 4단원의 mission_cron.py를 실행하고 정상 완료되었는지 보고해줘."`
2. 명령을 입력하면 안티그래비티가 백그라운드 스케줄을 즉시 등록하고 대기 모드로 들어갑니다. (메시지 수신 시 자동으로 Wakeup 합니다.)
3. 30초 후 알람이 발동하면 안티그래비티가 자동으로 깨어나 `run_command` 등으로 `mission_cron.py`를 실행하고 그 실행 결과를 사장님께 채팅 메시지로 브리핑합니다.
4. `[SUCCESS] Chapter 4 Mission Completed!` 결과가 요약 보고되면 완료됩니다.

---

## 🎉 마스터리 축하합니다!
모든 실습 단원을 마쳤습니다. 이제 에이전트를 조율하는 진정한 '마스터'가 되셨습니다.
* 👉 **[메인 로드맵 README.md로 돌아가기](file:///c:/Users/ismadmin/Documents/Workspace/Pn7_Mastery/README.md)**
