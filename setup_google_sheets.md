# How to Connect Google Sheets

The React app does not connect directly to the Google Sheet URL. Instead, it talks to a **Google Apps Script** that acts as an API bridge.

## Step 1: Prepare the Sheet
1. Create a new Google Sheet.
2. In the first row, add these exact headers:
   `Date` | `Time` | `Roll Number` | `Class` | `Name`

## Step 2: Add the Script
1. In the Sheet, go to **Extensions** > **Apps Script**.
2. Delete any code there and paste the code from the file `apps_script_code.gs` (I have created this file in your project folder).
3. **Save** the project (Ctrl+S).

## Step 3: Deploy as Web App (Crucial)
1. Click the blue **Deploy** button > **New deployment**.
2. Click the gear icon (Select type) > **Web app**.
3. Fill in the details:
   - **Description**: "Attendance API"
   - **Execute as**: "Me"
   - **Who has access**: **"Anyone"** (Important! Otherwise the app cannot write to it).
4. Click **Deploy**.
5. **Grant Access** when asked.
6. **COPY the "Web App URL"** (it starts with `https://script.google.com/macros/s/...`).

## Step 4: Link to React App
1. Open the file `src/services/sheetsApi.js`.
2. Replace the placeholder with your copied URL:
   ```javascript
   const APPS_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_COPIED_ID/exec";
   ```
