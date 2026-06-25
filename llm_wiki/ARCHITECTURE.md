# LLM Wiki Architecture

## 1. 개요 (Overview)
`llm_wiki` 프로젝트는 텔레그램 메신저와 로컬 터미널을 통해 사용자가 지식을 컴파일하고, 질문(검색)하며, 잘못된 지식을 롤백(삭제)할 수 있는 개인화된 '지능형 위키(Intelligent Wiki)' 시스템입니다. 
가장 큰 특징은 **Hybrid RAG + Agentic Web Search Fallback (Human-in-the-loop)** 설계를 채택하여, 내부 보안 지식을 최우선으로 하되 필요시 즉시 외부의 최신 지식을 스카우트해 오는 완벽한 지식 생태계를 구축했다는 점입니다.

## 2. 필수 구성 요소 및 셋업 가이드 (Prerequisites)
다른 PC에서 본 시스템을 구축할 때 다음 환경이 필요합니다.
- **Python**: 3.9 이상
- **주요 패키지**: `chromadb`, `sentence-transformers`, `requests`
- **환경 변수**: `C:\Users\ismadmin\AppData\Local\hermes\.env` 파일 내에 다음 값이 세팅되어야 합니다.
  - `TELEGRAM_BOT_TOKEN`: 텔레그램 봇 API 토큰
  - `GEMINI_API_KEY`: Google Gemini API 키 (외부 검색 Tool 및 LLM 추론용)

## 3. 주요 디렉터리 구조
- `/wiki`: LLM이 지식을 융합하여 마크다운 형태로 기록하는 최종 위키 저장소.
- `/raw`: 텔레그램을 통해 전송한 원본 파일이 임시 저장되는 폴더.
- `/chroma_db`: ChromaDB Vector Index가 저장되는 데이터베이스.
- `/skills`: 시스템의 핵심 모듈(에이전트 기능)이 위치한 폴더.
- `wiki_orchestrator.py`: 텔레그램 API 폴링 및 분배를 담당하는 메인 데몬.
- `ask_wiki.py`: 터미널 환경에서 인터랙티브하게 사용할 수 있는 Q&A UI.

## 4. 에이전트 및 스킬 (Agents & Skills)

### 4.1. 지식 컴파일러 (Knowledge Compiler)
- **모듈**: `skills/skill_compile_wiki.py`
- `/raw`의 원본을 읽어 요약/정제 후 `/wiki`에 이어 붙이고, `skill_vector_db.py`를 통해 Vector DB에 청크 단위로 즉시 인덱싱합니다. `<!-- SOURCE_START: 원본파일명 -->` 주석으로 출처를 관리합니다.

### 4.2. 지식 검색기 (RAG Retriever)
- **모듈**: `skills/skill_ask_wiki.py`, `skills/skill_vector_db.py`
- 사용자의 질문을 Vector DB에서 검색하고 매칭된 조각들의 **원본 문서(Parent Document Retrieval)**를 통째로 읽어 LLM에게 제공하여 문맥 소실 현상을 방지합니다.

### 4.3. 롤백 에이전트 (Rollback/Deleter)
- **모듈**: `skills/skill_delete_source.py`
- 오염된 지식을 원본 파일명 기반 필터링(`where={"source": filename}`)으로 위키와 Vector DB에서 영구 삭제합니다.

### 4.4. 스카우트 에이전트 (Scout Agent & Agentic Fallback)
- **모듈**: `skills/skill_web_search.py`
- 내부 위키만으로 대답하기 벅찬 질문이 들어오면, LLM이 스스로 `[NEED_WEB_SEARCH]` 플래그를 띄웁니다.
- 오케스트레이터가 이를 감지하여 사용자에게 웹 검색 여부를 묻고(Y/N 또는 `#검색`), 승인 시 Gemini의 Google Search Grounding 기능을 활용해 외부 최신 팩트를 긁어옵니다.

## 5. 데이터 프로비넌스(출처 관리) 워크플로우
1. 사용자가 문서 전송 -> `#컴파일 원본명`
2. 컴파일러가 위키에 태그 부착 후 저장 -> Vector DB 메타데이터에 소스 기록
3. 오염 발견 시 `#삭제 원본명` -> 위키 파일 정규식 삭제 및 Vector DB 소스 쿼리 완전 삭제
