@echo off
REM Temporal Server Deployment Script
REM Adds Docker to PATH and starts Temporal + Postgres services

echo [TEMPORAL DEPLOYMENT] Starting Temporal Server with Persistence...
echo.

REM Add common Docker paths to current session
set "PATH=%PATH%;C:\Program Files\Docker\Docker\resources\bin"
set "PATH=%PATH%;C:\ProgramData\DockerDesktop\version-bin"
set "PATH=%PATH%;%USERPROFILE%\AppData\Local\Docker\cli-plugins"

echo [CHECK] Verifying Docker availability...
docker --version
if errorlevel 1 (
    echo [ERROR] Docker CLI not found. Please ensure Docker Desktop is fully started.
    echo [ERROR] You may need to close and reopen this terminal after Docker Desktop starts.
    pause
    exit /b 1
)

echo [DEPLOY] Starting Postgres and Temporal services...
cd /d "%~dp0"
docker compose -f orchestrator\docker-compose.yml up -d postgres temporal

if errorlevel 1 (
    echo [ERROR] Failed to start services. Check docker-compose.yml and Docker Desktop status.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Temporal services deployed!
echo.
echo [INFO] Checking service status...
docker compose -f orchestrator\docker-compose.yml ps

echo.
echo [NEXT STEPS]
echo 1. Verify services are healthy: docker compose -f orchestrator\docker-compose.yml logs
echo 2. Configure workers with TEMPORAL_HOST environment variable
echo 3. Start orchestrator worker to verify connection
echo.
pause
