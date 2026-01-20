@echo off
echo Setting up remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/eternardev-png/AlgoResearch-Lab.git

echo Renaming branch to main...
git branch -M main

echo Pushing to GitHub (Please authenticate if asked)...
git push -u origin main

echo Done!
pause
