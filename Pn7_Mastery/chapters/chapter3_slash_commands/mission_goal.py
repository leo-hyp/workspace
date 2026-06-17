# -*- coding: utf-8 -*-
# c:\Users\ismadmin\Documents\Workspace\Pn7_Mastery\chapters\chapter3_slash_commands\mission_goal.py

import sys
import json
import os

# 원본 원시 모니터링 데이터
RAW_METRICS = [
    {"timestamp": "2026-06-17T09:00:00", "cpu": 45, "memory": 72, "status": "OK"},
    {"timestamp": "2026-06-17T10:00:00", "cpu": 89, "memory": 91, "status": "WARNING"},
    {"timestamp": "2026-06-17T11:00:00", "cpu": 95, "memory": 96, "status": "CRITICAL"},
    {"timestamp": "2026-06-17T12:00:00", "cpu": 50, "memory": 68, "status": "OK"}
]

class SystemMetricsAnalyzer:
    def __init__(self, data):
        self.raw_data = data
        self.analyzed_result = {}

    def extract_critical_events(self):
        # ⚠️ TODO 1: CPU가 80 이상이거나 status가 OK가 아닌(WARNING, CRITICAL) 위험 이벤트만 추출해 
        # self.analyzed_result["critical_events"] = [...] 형태로 저장하세요.
        self.analyzed_result["critical_events"] = [
            event for event in self.raw_data
            if event["cpu"] >= 80 or event["status"] != "OK"
        ]

    def calculate_average_usage(self):
        # ⚠️ TODO 2: 전체 데이터의 CPU 및 Memory 평균 사용률을 각각 계산하여 
        # self.analyzed_result["avg_cpu"] 및 self.analyzed_result["avg_memory"] 에 대입하세요.
        total_cpu = sum(event["cpu"] for event in self.raw_data)
        total_memory = sum(event["memory"] for event in self.raw_data)
        count = len(self.raw_data)
        
        self.analyzed_result["avg_cpu"] = round(total_cpu / count, 2)
        self.analyzed_result["avg_memory"] = round(total_memory / count, 2)

    def export_report(self, file_path="chapter3_output.json"):
        # ⚠️ TODO 3: 최종 self.analyzed_result 딕셔너리를 인덴트 4칸의 이쁜 JSON 파일로 저장하세요.
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.analyzed_result, f, indent=4)

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    print("Initializing System Metrics Analyzer...")
    
    # chapter3_output.json 파일 초기화 (테스트용)
    if os.path.exists("chapter3_output.json"):
        os.remove("chapter3_output.json")
    
    analyzer = SystemMetricsAnalyzer(RAW_METRICS)
    
    # ⚠️ [미션] 아래의 TODO 비즈니스 로직 함수들을 완벽하게 구현하여 검증 루프를 완료하십시오.
    analyzer.extract_critical_events()
    analyzer.calculate_average_usage()
    analyzer.export_report()
    
    # 미션 성공 조건 검증
    try:
        if os.path.exists("chapter3_output.json"):
            with open("chapter3_output.json", "r") as f:
                data = json.load(f)
                if data.get("avg_cpu") is not None and len(data.get("critical_events", [])) > 0:
                    print("[SUCCESS] Chapter 3 Mission Completed!")
                    print(f"Generated Output Data: {json.dumps(data, indent=2)}")
                else:
                    print("[FAIL] Result format is incomplete or empty.")
        else:
            print("[FAIL] chapter3_output.json report file was not created.")
    except Exception as e:
        print(f"[FAIL] Output file error: {e}")

if __name__ == "__main__":
    main()
