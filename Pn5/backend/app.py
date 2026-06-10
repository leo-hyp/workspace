import os
import json
from flask import Flask, jsonify, request, send_from_directory
import subprocess

# 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
JSON_PATH = os.path.join(BASE_DIR, 'sources.json')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

def load_sources():
    if not os.path.exists(JSON_PATH):
        return []
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_sources(sources):
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(sources, f, ensure_ascii=False, indent=2)

# --------- 정적 파일 제공 (Frontend) ---------
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)


# --------- API: RSS 매체 소스 관리 ---------
@app.route('/api/sources', methods=['GET'])
def get_sources():
    return jsonify(load_sources())

@app.route('/api/sources', methods=['POST'])
def add_source():
    data = request.json
    name = data.get('name')
    url = data.get('url')
    
    if not name or not url:
        return jsonify({"error": "Name and URL are required"}), 400
        
    sources = load_sources()
    
    # 중복 체크
    if any(s.get('url') == url or s.get('name') == name for s in sources):
        return jsonify({"error": "Source already exists"}), 409
        
    new_id = max([s.get('id', 0) for s in sources], default=0) + 1
    new_source = {"id": new_id, "name": name, "url": url}
    sources.append(new_source)
    save_sources(sources)
    
    return jsonify(new_source), 201

@app.route('/api/sources/<int:id>', methods=['DELETE'])
def delete_source(id):
    sources = load_sources()
    sources = [s for s in sources if s.get('id') != id]
    save_sources(sources)
    return jsonify({"success": True})

# --------- API: 에이전트 구동 (트리거) ---------
@app.route('/api/run_harness', methods=['POST'])
def run_harness():
    try:
        # Pn5/agents 폴더에서 orchestrator.py 실행
        agents_dir = os.path.join(BASE_DIR, 'agents')
        process = subprocess.Popen(['python', 'orchestrator.py'], cwd=agents_dir)
        return jsonify({"success": True, "message": "Orchestrator started in background"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
