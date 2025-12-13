// CODE FOR GOOGLE APPS SCRIPT
// 1. Open your Google Sheet
// 2. Extensions > Apps Script
// 3. Paste this code into Code.gs
// 4. Deploy > New Deployment > Web App > Who has access: "Anyone"

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const action = e.parameter.action || (e.postData && JSON.parse(e.postData.contents).action);

    if (!action || action === 'read') {
      // GET: Read all data
      const rows = sheet.getDataRange().getValues();
      const headers = rows.shift(); // Remove header row
      const data = rows.map((row, index) => {
        return {
          id: index + 2, // Row number (1-based, +1 for header removed)
          date: row[0], // Adjust indices based on your columns
          time: row[1],
          rollNumber: row[2],
          class: row[3],
          name: row[4]
        };
      });
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    } 

    else if (action === 'add') {
      // POST: Add Row
      const body = JSON.parse(e.postData.contents);
      // Expected columns: Date, Time, Roll Number, Class, Name
      sheet.appendRow([body.date, body.time, body.rollNumber, body.class, body.name]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'delete') {
      // POST: Delete Row
      const body = JSON.parse(e.postData.contents);
      const rowNumber = parseInt(body.id); // Expecting row number as ID
      
      if (rowNumber > 0) {
        sheet.deleteRow(rowNumber);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
      } else {
         throw new Error("Invalid Row ID");
      }
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}
