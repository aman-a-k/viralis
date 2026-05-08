@echo off
echo Please create an empty private repository on GitHub first.
echo Then paste the HTTPS link of that repository below:
set /p repolink="GitHub Repository URL (e.g. https://github.com/YourUsername/ai-automator.git): "
git remote add origin %repolink%
git branch -M main
git push -u origin main
echo Done! Your code has been pushed.
pause
