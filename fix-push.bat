@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo  Fix GitHub Desktop line-ending warning + push
echo ==============================================
echo.

git config core.autocrlf false
git config core.eol lf

echo [1/4] Writing .gitattributes with forced LF endings...
echo * text eol=lf> .gitattributes

echo [2/4] Converting tracked CRLF/mixed files to LF...
powershell -NoProfile -ExecutionPolicy Bypass -Command "git ls-files --eol | ForEach-Object { if ($_ -match 'w/(crlf|mixed)[^\t]*\t(.+)$') { $p = (Resolve-Path -LiteralPath $matches[2]).Path; $c = [System.IO.File]::ReadAllText($p); $n = $c -replace ([string][char]13 + [string][char]10), [string][char]10; [System.IO.File]::WriteAllText($p, $n, (New-Object System.Text.UTF8Encoding($false))) } }"

echo [3/4] Staging and committing line-ending normalization...
git add --renormalize .
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "fix: normalize line endings to LF" --no-verify
) else (
    echo No line-ending changes to commit.
)

echo [4/4] Pushing to origin...
for /f "usebackq delims=" %%B in (`git branch --show-current`) do set BR=%%B
git push origin %BR%
if errorlevel 1 (
    echo.
    echo *** Push FAILED - see error above ***
) else (
    echo.
    echo *** Push successful! Warning should be gone in GitHub Desktop. ***
)

pause
