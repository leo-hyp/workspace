import os
import re
from skills import skill_vector_db

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
WIKI_DIR = os.path.join(WORKSPACE, "wiki")

def delete_source(filename):
    """
    지정된 원본 파일명(filename)에서 파생된 모든 지식을 위키와 벡터DB에서 삭제합니다.
    """
    print(f"[DeleteAgent] 🗑️ Deleting all traces of '{filename}'...")
    
    # 1. Vector DB에서 메타데이터 기반 삭제
    skill_vector_db.delete_by_source(filename)
    
    # 2. 마크다운 파일들에서 주석 블록 제거
    pattern = re.compile(rf"<!-- SOURCE_START: {re.escape(filename)} -->.*?<!-- SOURCE_END: {re.escape(filename)} -->\n*", re.DOTALL)
    
    deleted_count = 0
    for md_file in os.listdir(WIKI_DIR):
        if not md_file.endswith(".md"): continue
        
        filepath = os.path.join(WIKI_DIR, md_file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if f"SOURCE_START: {filename}" in content:
            new_content = pattern.sub("", content)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"[DeleteAgent] Cleaned markdown file: {md_file}")
            deleted_count += 1
            
    print(f"[DeleteAgent] ✅ Deletion complete. Affected {deleted_count} markdown files.")
    return True

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        delete_source(sys.argv[1])
    else:
        print("Usage: python skill_delete_source.py <filename>")
