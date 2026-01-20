try:
    import fastapi
    import uvicorn
    import websockets
    print("Dependencies OK")
except ImportError as e:
    print(f"Missing: {e.name}")
