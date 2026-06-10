import sys
import json
import uuid
import os
from datetime import datetime

def add_task(task_content):
    inbox_file = os.path.join(os.path.dirname(__file__), 'inbox.json')
    
    # Read existing tasks
    tasks = []
    if os.path.exists(inbox_file):
        try:
            with open(inbox_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    tasks = json.loads(content)
        except Exception as e:
            print(f"Error reading inbox.json: {e}")
            tasks = []
            
    # Append new task
    new_task = {
        "id": "task-" + str(uuid.uuid4())[:8],
        "task": task_content,
        "status": "pending",
        "timestamp": datetime.now().isoformat()
    }
    tasks.append(new_task)
    
    # Save back
    try:
        with open(inbox_file, 'w', encoding='utf-8') as f:
            json.dump(tasks, f, ensure_ascii=False, indent=2)
        print("Task added successfully to inbox.json!")
    except Exception as e:
        print(f"Error writing to inbox.json: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        task_text = " ".join(sys.argv[1:])
        add_task(task_text)
    else:
        print("Usage: python add_task.py \"task content here\"")
