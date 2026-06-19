import os
import sys
import time
import io
import re
from datetime import datetime
from skills.skill_ingest_telegram import poll_telegram_updates, send_telegram_reply, send_telegram_document
from skills.skill_compile_wiki import compile_all
from skills.skill_plan_report import plan_report
from skills.skill_write_report import write_report
from skills.skill_ask_wiki import ask_wiki

sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
REPORTS_DIR = os.path.join(WORKSPACE, "reports")

def process_report_command(chat_id, topic):
    if not topic:
        send_telegram_reply(chat_id, "주제를 입력해주세요. 예: /report 2026 병원 보안 트렌드")
        return
        
    send_telegram_reply(chat_id, f"📝 '{topic}' 주제로 심층 연구 리포트 작성을 시작합니다... (목차 기획 중)")
    
    toc = plan_report(topic, "Deep Dive")
    if not toc:
        send_telegram_reply(chat_id, "❌ 기획 에이전트 실패: 목차를 생성하지 못했습니다.")
        return
        
    send_telegram_reply(chat_id, f"✅ 기획 완료. {len(toc)}개의 챕터로 본문 작성을 시작합니다... (약 1분 소요)")
    
    report_content = write_report(topic, "Deep Dive", toc)
    if report_content.startswith("Error"):
        send_telegram_reply(chat_id, f"❌ 작성 에이전트 실패: {report_content}")
        return
        
    # Save report
    os.makedirs(REPORTS_DIR, exist_ok=True)
    safe_title = re.sub(r'[^a-zA-Z0-9가-힣]', '_', topic)[:50].strip('_')
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{safe_title}.md"
    filepath = os.path.join(REPORTS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(report_content)
        
    # Send report
    send_telegram_document(chat_id, filepath, caption=f"📄 '{topic}' 심층 연구 리포트가 완성되었습니다!")

def process_ask_command(chat_id, question):
    if not question:
        send_telegram_reply(chat_id, "질문을 입력해주세요. 예: #질문 LLM OS의 핵심이 뭐야?")
        return
        
    send_telegram_reply(chat_id, f"🔍 '{question}'에 대한 답을 지식망에서 찾고 있습니다...")
    
    answer = ask_wiki(question)
    
    if len(answer) > 4000:
        answer = answer[:4000] + "\n\n...(답변이 길어 잘렸습니다.)"
        
    send_telegram_reply(chat_id, answer)

def main():
    print("🚀 [Orchestrator] Starting LLM Wiki Daemon...")
    offset = None
    last_compile_time = time.time()
    COMPILE_INTERVAL = 600  # Compile every 10 minutes (for testing, normally 24 hours)
    
    try:
        while True:
            # 1. Ingest Phase: Poll Telegram for new messages
            new_offset, pending_commands = poll_telegram_updates(offset)
            if new_offset is not None:
                offset = new_offset + 1
                
            for cmd in pending_commands:
                cmd_type = cmd.get("type", "report")
                if cmd_type == "report":
                    process_report_command(cmd.get("chat_id"), cmd.get("topic"))
                elif cmd_type == "ask":
                    process_ask_command(cmd.get("chat_id"), cmd.get("question"))
                
            # 2. Compile Phase: Check if it's time to compile
            current_time = time.time()
            if current_time - last_compile_time > COMPILE_INTERVAL:
                print("\n[Orchestrator] 🕒 Scheduled compilation triggered.")
                compiled_count = compile_all()
                if compiled_count > 0:
                    print(f"[Orchestrator] ✅ Compiled {compiled_count} raw documents into the Wiki.")
                last_compile_time = current_time
                
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\n[Orchestrator] Stopped by user.")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    main()
