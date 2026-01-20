@echo off
echo ==========================================
echo       FULL GITHUB SYNC SCRIPT
echo ==========================================

echo [1/8] Configuring Git Network Settings (Anti-Timeout)...
git config --global http.postBuffer 1048576000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
git config --global sendpack.sideband false

echo [2/8] Setting Remote URL...
git remote remove origin 2>nul
git remote add origin https://github.com/eternardev-png/trading.git

echo [3/8] Cleaning Git Index (Preparing for clean upload)...
git rm -r --cached . >nul 2>&1

echo [4/8] Adding Files (Respecting .gitignore)...
git add .

echo [5/8] Committing...
git commit -m "Full Project Sync" 

echo [6/8] Naming branch 'main'...
git branch -M main

echo [7/8] Pushing to GitHub (FORCE)...
echo Please enter your GitHub credentials if prompted.
git push -u origin main --force

echo ==========================================
echo                 DONE
echo ==========================================
pause
