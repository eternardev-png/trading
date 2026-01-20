import sys
import subprocess
import time
import webbrowser
import os
import signal

def main():
    if len(sys.argv) < 2 or sys.argv[1] != "start":
        print("Usage: glf start")
        return

    # Ensure we are running from the script's directory so app.py is found
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    print("--- GLF Launcher ---")
    print("Starting Streamlit app...")

    # Start Streamlit in specific port to be sure
    cmd = [sys.executable, "-m", "streamlit", "run", "app.py", "--server.port=8501", "--server.headless=true"]
    
    # We use Shell=False to keep it as a child process we can easily kill
    # However, capturing output might be nice. For now, let's let it inherit stdout/stderr 
    # so the user sees logs in the console.
    proc = subprocess.Popen(cmd)

    print(f"App running with PID: {proc.pid}")
    print("--------------------------------------------------")
    print("COMMANDS:")
    print(" [w] : Open Browser (http://localhost:8501)")
    print(" [q] or [Ctrl+C] : Stop Server and Exit")
    print("--------------------------------------------------")

    try:
        # Windows specific keyboard handling
        import msvcrt
        
        while True:
            # check if process is still alive
            if proc.poll() is not None:
                print("Streamlit process ended unexpectedly.")
                break

            if msvcrt.kbhit():
                key = msvcrt.getch().decode('utf-8').lower()
                
                if key == 'w':
                    print("Opening browser...")
                    webbrowser.open("http://localhost:8501")
                elif key == 'q':
                    print("Quitting...")
                    break
            
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nCtrl+C detected.")
    except ImportError:
        # Fallback for non-windows (though user is on windows)
        print("msvcrt not found, interactive commands disabled. Press Ctrl+C to stop.")
        try:
            proc.wait()
        except KeyboardInterrupt:
            pass
    finally:
        print("Stopping app...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Done.")

if __name__ == "__main__":
    main()
