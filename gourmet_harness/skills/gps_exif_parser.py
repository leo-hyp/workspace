import os
import json
import logging

def parse_exif(image_path):
    """
    Simulated EXIF parser for Gourmet-Finder
    """
    logging.info(f"Parsing EXIF data for {image_path}")
    # 가상의 EXIF 데이터 반환
    return {
        "latitude": "37.5665",
        "longitude": "126.9780",
        "timestamp": "2026-06-09T12:00:00",
        "camera": "iPhone 15 Pro",
        "status": "success"
    }

if __name__ == "__main__":
    print(json.dumps(parse_exif("sample.jpg"), indent=2))
