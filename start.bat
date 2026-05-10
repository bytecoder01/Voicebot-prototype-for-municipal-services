@echo off
REM Quick start script for the voicebot project
REM This starts both the backend and ngrok tunnel

echo.
echo ========================================
echo   Voicebot Setup - Municipal Services
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker not found. Installing dependencies for local setup...
    echo.
    echo Starting backend server locally...
    cd backend
    npm install
    npm start
) else (
    echo [INFO] Docker found. Starting with Docker Compose...
    echo.
    docker-compose up -d
    echo.
    echo ✓ Backend running on port 3000
    echo ✓ Frontend running on port 8080 (http://localhost:8080)
    echo.
    echo Starting ngrok tunnel...
    echo.
    
    REM Check if ngrok is installed
    ngrok --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo Installing ngrok globally...
        npm install -g ngrok
    )
    
    ngrok http 3000 --log stdout
)
