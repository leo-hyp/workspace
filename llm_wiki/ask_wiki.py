import os
import sys
from skills.skill_ask_wiki import ask_wiki

# Ensure utf-8 encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')

def main():
    print("==================================================")
    print(" 🧠 LLM Wiki Local Q&A Agent 터미널")
    print("==================================================")
    print("로컬 컴퓨터에서 위키 지식망에 직접 질문하는 창구입니다.")
    print("질문을 입력하세요. (종료하려면 'exit' 또는 'quit' 입력)\n")
    
    while True:
        try:
            question = input("\n[질문] > ")
            if question.strip().lower() in ['exit', 'quit']:
                print("터미널을 종료합니다.")
                break
                
            if not question.strip():
                continue
                
            from skills.skill_web_search import web_search

            print("🔍 위키 지식망에서 답변을 찾는 중...")
            answer = ask_wiki(question)
            
            needs_search = False
            if "[NEED_WEB_SEARCH]" in answer:
                answer = answer.replace("[NEED_WEB_SEARCH]", "").strip()
                needs_search = True
                
            print(f"\n[답변]\n{answer}\n")
            
            if needs_search:
                user_choice = input("💡 위키에 정보가 부족합니다. 최신 구글 웹 검색을 통해 상세 정보를 가져올까요? [Y/N] > ")
                if user_choice.strip().upper() in ['Y', 'YES', '네', '응']:
                    print("\n🌐 스카우트 에이전트가 실시간 웹 검색 중...")
                    web_answer = web_search(question)
                    print(f"\n[웹 검색 결과]\n{web_answer}\n")
                    
            print("-" * 50)
            
        except KeyboardInterrupt:
            print("\n터미널을 종료합니다.")
            break
        except Exception as e:
            print(f"오류 발생: {e}")

if __name__ == "__main__":
    main()
