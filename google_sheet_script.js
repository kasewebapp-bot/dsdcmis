// Handling Read requests
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = e.parameter.sheet || "Centres";
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Sheet not found"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "data": rows}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetName = data.sheetName || data.sheet; // Supports both 'sheetName' and 'sheet' keys
    const action = data.action || 'append';
    const rows = data.rows; // Array of objects
    
    // Get the active spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // If there's data, use keys of first object as headers
      if (rows && rows.length > 0) {
        const headers = Object.keys(rows[0]);
        sheet.appendRow(headers);
        // Make headers bold
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      }
    }
    
    if (action === 'updatePassword') {
      const username = data.username;
      const newPassword = data.newPassword;
      
      if (!username || !newPassword) {
        return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Missing username or newPassword"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const sheetData = sheet.getDataRange().getValues();
      const headers = sheetData[0];
      const usernameIndex = headers.indexOf("Username");
      const passwordIndex = headers.indexOf("Password");
      
      if (usernameIndex === -1 || passwordIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Username or Password column not found in sheet"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      let updated = false;
      for (let i = 1; i < sheetData.length; i++) {
        if (sheetData[i][usernameIndex] === username) {
          // Update the cell (row is i + 1, col is passwordIndex + 1 since getRange is 1-indexed)
          sheet.getRange(i + 1, passwordIndex + 1).setValue(newPassword);
          updated = true;
          break; // Assuming usernames are unique
        }
      }
      
      if (updated) {
        return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Password updated"}))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // Username not found, so append them as a new user!
        const newRowData = [];
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i].trim().toLowerCase();
          if (header === 'username') newRowData.push(username);
          else if (header === 'password') newRowData.push(newPassword);
          else if (header === 'name') newRowData.push(data.name || username);
          else newRowData.push(""); // empty for other columns
        }
        sheet.appendRow(newRowData);
        
        return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "User added and password set"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      // Append rows (default action)
      if (rows && rows.length > 0) {
        // Get headers from sheet
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        const rowsToAppend = rows.map(rowObj => {
          return headers.map(header => {
            let val = rowObj[header];
            // Convert objects/arrays to string (like Firebase timestamps)
            if (val && typeof val === 'object') {
               val = JSON.stringify(val);
            }
            return val === undefined ? "" : val;
          });
        });
        
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
      }
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handling Preflight requests (CORS)
function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
