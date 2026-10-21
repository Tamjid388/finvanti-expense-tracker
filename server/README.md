# Expense Tracker - Server

Python backend setup (Python 3.13).

## Installation

1. Go to server folder:
```powershell
cd server
```

2. Create virtual environment (if `venv` doesn't exist):
```powershell
python -m venv venv
```

3. Activate virtual environment:

Windows PowerShell:
```powershell
.\venv\Scripts\Activate.ps1
```

Windows CMD:
```cmd
venv\Scripts\activate.bat
```

Linux / macOS:
```bash
source venv/bin/activate
```

If PowerShell blocks activation, run once:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```
Then retry step 3.

4. Install dependencies:
```powershell
pip install -r requirements.txt
```

5. Run server:
```powershell
python app.py
```

6. Deactivate when done:
```powershell
deactivate
```
