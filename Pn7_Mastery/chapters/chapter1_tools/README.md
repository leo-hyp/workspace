# 🛠️ 1단원: 도구 제어 (Tool Mastery)

이 단원에서는 안티그래비티가 뒤에서 어떻게 사장님의 컴퓨터 자원을 제어하는지 파악하고, 기본적인 상호작용 흐름을 실습합니다.

---

## 💡 이론: 에이전트의 5대 무기 (도구)

안티그래비티는 일반 챗봇과 달리, 사장님의 시스템 환경에서 직접적인 동작을 수행할 수 있는 권한과 **도구(Tools)**를 가지고 있습니다.

1. **`view_file`**: 지정된 파일의 텍스트나 이미지를 직접 읽어서 기억 장치에 올립니다. (최대 800줄 제한)
2. **`replace_file_content` / `multi_replace_file_content`**: 특정 파일의 코드를 정교하게 수정합니다. (전체 덮어쓰기가 아닌 필요한 부분만 조준 타격하여 비용과 리소스를 절약합니다.)
3. **`write_to_file`**: 새로운 파일을 생성합니다.
4. **`run_command`**: 사장님의 터미널(PowerShell)에 명령어를 보냅니다. (이 명령어는 실행 전 반드시 **사장님의 화면 승인**을 거쳐야만 작동하므로 매우 안전합니다.)
5. **`grep_search`**: 프로젝트 내에서 원하는 키워드나 에러 로그가 위치한 파일을 순식간에 찾아냅니다.

---

## 🎯 실습 미션 1: 에러투성이 스크립트 치료하기

현재 이 폴더에 생성되어 있는 [mission_tool.py](file:///c:/Users/ismadmin/Documents/Workspace/Pn7_Mastery/chapters/chapter1_tools/mission_tool.py) 파일은 문법 에러와 실행 에러가 있어 제대로 돌지 못합니다.

### 📝 미션 수행 방법
1. 대화창에 아래와 같이 명령을 타이핑하여 입력해 보세요:
   > **명령 예시:** `"Pn7_Mastery 1단원의 mission_tool.py 파일을 열어서 에러를 찾아내고, 정상 작동하도록 수정한 뒤 터미널에서 실행해봐."`
2. 입력 후, 안티그래비티가 다음과 같이 도구들을 유기적으로 사용하는 모습을 지켜보세요:
   * **`view_file`**을 사용해 `mission_tool.py`를 스캔합니다.
   * **`replace_file_content`**를 사용해 문법 오류와 논리 오류를 고칩니다.
   * **`run_command`**를 사용해 `python mission_tool.py`를 구동하는 승인 요청을 사장님께 보냅니다.
3. 승인 요청 팝업이 뜨면 **[Approve]** 버튼을 눌러 실행을 허용합니다.
4. 콘솔에 `[SUCCESS] Chapter 1 Mission Completed!`라는 정상 출력 로그가 찍히면 미션이 완료됩니다.

---

## ⏭️ 다음 단계로
미션을 성공적으로 완료하셨다면, 2단원으로 이동하여 계획 수립 방식에 대해 배워보겠습니다.
* 👉 **[2단원: 계획 협업 (Planning Mode) 바로가기](file:///c:/Users/ismadmin/Documents/Workspace/Pn7_Mastery/chapters/chapter2_planning/README.md)**
