@echo off
REM Start the Roadmap Generator Server

echo.
echo ========================================
echo Roadmap Generator Server Startup
echo ========================================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please create .env with: GEMINI_API_KEY=your_api_key
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exist
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

echo.
echo Starting server on http://localhost:5178
echo Press Ctrl+C to stop the server
echo.

call node index.js

pause
