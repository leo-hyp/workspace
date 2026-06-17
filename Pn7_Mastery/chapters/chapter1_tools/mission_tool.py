# -*- coding: utf-8 -*-
# c:\Users\ismadmin\Documents\Workspace\Pn7_Mastery\chapters\chapter1_tools\mission_tool.py

def main():  # 미션 수행 시 문법 에러 및 기타 에러가 포함되어 있습니다.
    # [에러 1] 문자열 쿼터 미스매치 (SyntaxError) 해결
    print("Welcome to Chapter 1 Mission!")

    # [에러 2] 0으로 나누기 (ZeroDivisionError) 해결
    total_score = 100
    active_users = 5  # 이 값을 1 이상(5)으로 변경하여 ZeroDivisionError를 방지합니다.
    
    score_per_user = total_score / active_users
    print(f"Score per user: {score_per_user}")
    
    print("[SUCCESS] Chapter 1 Mission Completed!")

if __name__ == "__main__":
    main()
