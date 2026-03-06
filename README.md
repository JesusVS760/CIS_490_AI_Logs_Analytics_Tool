# CIS 490 AI Logs Analytics Tool

Project Setup:

npm install
npm run dev

Environment Setup (required for GitHub login):

1. Copy `.env.example` to `.env`
2. Fill these values in `.env`:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_REDIRECT_URI` (use `http://localhost:3000/api/auth/github/callback` for local dev)
3. Restart the dev server after editing `.env`

DB Setup:

npm install better-sqlite3
npm install -D @types/better-sqlite3

test for ci/cd

Also for Windows Install insure you have privileges to powershell

In Powershell as Admin run: Set-ExecutionPolicy RemoteSigned and when prompted enter in A to execute permissions
