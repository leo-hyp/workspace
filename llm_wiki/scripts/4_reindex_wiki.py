import os
import sys
import io

# 윈도우 cp949 콘솔에서 이모지 출력 시 발생하는 UnicodeEncodeError 방지
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

# Add parent directory to path so we can import skills
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from skills import skill_vector_db

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
WIKI_DIR = os.path.join(WORKSPACE, "wiki")

def reindex_all():
    print("🚀 Starting legacy wiki re-indexing to Vector DB...")
    
    count = 0
    for filename in os.listdir(WIKI_DIR):
        if not filename.endswith(".md"):
            continue
            
        filepath = os.path.join(WIKI_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if not content.strip():
            continue
            
        # Split by empty lines to get paragraphs as chunks
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        texts = []
        metadatas = []
        ids = []
        
        for i, para in enumerate(paragraphs):
            title = filename.replace('.md', '')
            chunk_text = f"[문서 제목: {title}]\n{para}"
            texts.append(chunk_text)
            metadatas.append({"source": "legacy", "target_md": filename})
            ids.append(f"{filename}_legacy_{i}")
            
        if texts:
            skill_vector_db.add_documents(texts, metadatas, ids)
            count += len(texts)
            print(f"Indexed {len(texts)} chunks from {filename}")
            
    print(f"✅ Re-indexing complete. Total {count} chunks added to Vector DB.")

if __name__ == "__main__":
    reindex_all()
