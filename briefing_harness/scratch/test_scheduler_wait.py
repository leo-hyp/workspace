import time
from datetime import datetime
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

def wait_until_target_time(target_hour, target_minute):
    now = datetime.now()
    target_today = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    
    if now < target_today:
        sleep_seconds = (target_today - now).total_seconds()
        print(f"⏰ [Scheduler] 현재 시간 {now.strftime('%H:%M:%S')}. 목표 발송 시간 {target_today.strftime('%H:%M:%S')}까지 {sleep_seconds:.1f}초 동안 대기합니다...")
        
        while True:
            current_time = datetime.now()
            if current_time >= target_today:
                break
            remaining = (target_today - current_time).total_seconds()
            sleep_chunk = min(5.0, remaining) # Use 5s chunk for faster testing logs
            if sleep_chunk <= 0:
                break
            print(f"⏰ [Scheduler] 대기 중... 남은 시간: {int(remaining)}초")
            time.sleep(sleep_chunk)
        print(f"⏰ [Scheduler] 목표 시간 {target_today.strftime('%H:%M:%S')}에 도달하였습니다. 발행 작업을 진행합니다.")
    else:
        print(f"⏰ [Scheduler] 현재 시간 {now.strftime('%H:%M:%S')}이 목표 시간 {target_today.strftime('%H:%M:%S')} 이후이므로 대기 없이 즉시 발행합니다.")

if __name__ == "__main__":
    # Test 1: target is in the past
    print("--- Test 1: Past Target (should execute immediately) ---")
    wait_until_target_time(6, 0)
    
    # Test 2: target is in the future (set target to 15 seconds from now)
    print("\n--- Test 2: Future Target (should sleep and log) ---")
    now = datetime.now()
    from datetime import timedelta
    future_time = now + timedelta(minutes=1)
    print(f"Scheduling target for: {future_time.strftime('%H:%M:00')}")
    wait_until_target_time(future_time.hour, future_time.minute)
