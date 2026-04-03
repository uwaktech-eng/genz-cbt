FILES INCLUDED
- index.html
- student.html
- admin.html
- Code.gs

SETUP
1. Create one Google Sheet.
2. Copy its ID and paste into Code.gs at SPREADSHEET_ID.
3. Open script.google.com and create a new Apps Script project.
4. Paste Code.gs.
5. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone
6. Copy the Web App URL.
7. Paste that URL into APPS_SCRIPT_URL inside student.html and admin.html.
8. Upload index.html, student.html, and admin.html to GitHub and deploy with Vercel.

GOOGLE SHEET TABS AUTO-CREATED
- Settings
- Candidates
- Questions
- Results

IMPORTANT
This version does not include admin authentication. Anyone with the admin.html link can use the admin page.
