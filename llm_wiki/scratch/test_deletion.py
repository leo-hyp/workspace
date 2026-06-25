import os
import sys

# Add parent directory to path so we can import skills
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from skills import skill_delete_source

if __name__ == "__main__":
    skill_delete_source.delete_source("dummy.txt")
