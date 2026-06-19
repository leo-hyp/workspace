import os
import sys
from datetime import datetime

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
RAW_DIR = os.path.join(WORKSPACE, "raw")

def ingest(content, source="manual"):
    os.makedirs(RAW_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{source}.txt"
    filepath = os.path.join(RAW_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Ingested to {filepath}")

if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
        ingest(text, "cli")
    else:
        text = sys.stdin.read()
        if text.strip():
            ingest(text, "stdin")
        else:
            print("❌ Provide text via CLI args or STDIN")
