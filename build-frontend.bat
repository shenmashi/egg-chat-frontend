@echo off
chcp 65001 >nul
echo ========================================
echo    前端构建脚本
echo ========================================
echo.

echo [1/3] 检查并设置环境变量...
REM 检查 .env.production 文件
if exist ".env.production" (
    echo    发现 .env.production 文件
    findstr /C:"REACT_APP_API_BASE_URL" .env.production | findstr /V "^#" >nul 2>&1
    if %errorlevel% equ 0 (
        echo    检查 .env.production 中的配置...
        findstr /C:"REACT_APP_API_BASE_URL=http" .env.production >nul 2>&1
        if %errorlevel% equ 0 (
            echo    [警告] .env.production 中设置了 REACT_APP_API_BASE_URL
            echo    请确保 .env.production 中设置为空值: REACT_APP_API_BASE_URL=
        )
    )
) else (
    echo    未发现 .env.production 文件（将使用默认配置）
)

REM 确保不设置 REACT_APP_API_BASE_URL，让前端使用相对路径（通过 Nginx 代理）
REM 使用 set 命令设置环境变量为空（批处理方式，会覆盖 .env.production 中的值）
set REACT_APP_API_BASE_URL=
set REACT_APP_SOCKET_URL=

REM 也尝试 PowerShell 方式清除（如果存在）
powershell -Command "Remove-Item Env:REACT_APP_API_BASE_URL -ErrorAction SilentlyContinue" 2>nul
powershell -Command "Remove-Item Env:REACT_APP_SOCKET_URL -ErrorAction SilentlyContinue" 2>nul

REM 再次设置为空，确保当前会话中环境变量为空
set REACT_APP_API_BASE_URL=
set REACT_APP_SOCKET_URL=

REM 验证环境变量是否为空
echo    验证环境变量状态:
if "%REACT_APP_API_BASE_URL%"=="" (
    echo       ✓ REACT_APP_API_BASE_URL 已设置为空
) else (
    echo       ✗ REACT_APP_API_BASE_URL = %REACT_APP_API_BASE_URL%
    echo       [警告] 环境变量仍有值，可能需要清除系统环境变量
)

if "%REACT_APP_SOCKET_URL%"=="" (
    echo       ✓ REACT_APP_SOCKET_URL 已设置为空
) else (
    echo       ✗ REACT_APP_SOCKET_URL = %REACT_APP_SOCKET_URL%
    echo       [警告] 环境变量仍有值，可能需要清除系统环境变量
)

echo.
echo    注意：生产环境应使用相对路径，通过 Nginx 代理到后端
echo    如果环境变量仍有值，请手动清除系统环境变量后重新运行此脚本
echo.

echo [2/3] 清理旧的构建文件...
if exist build (
    echo    删除 build 目录...
    rmdir /s /q build 2>nul
    echo    清理完成
) else (
    echo    build 目录不存在，跳过清理
)
echo.

echo [3/3] 开始构建...
echo    正在构建前端（这可能需要几分钟）...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    构建成功！
    echo ========================================
    echo.
    echo 构建文件位置: build\
    echo.
    echo 下一步：
    echo   1. 确保 Nginx 配置中的 root 路径指向 build 目录
    echo   2. 重启 Nginx: nginx-restart.bat
    echo   3. 访问: http://qhkf.qh1851.com:8989
    echo.
) else (
    echo.
    echo [错误] 构建失败！
    echo 请检查错误信息
    echo.
)

pause

