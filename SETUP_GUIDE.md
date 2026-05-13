DSDC MIS - Setup Instructions

To get the MIS fully working, you need to configure two external services: Firebase (for Auth and Database) and Google Sheets (for Cloud Backup).

---

### Step 1: Firebase Configuration (Required)

The MIS uses Firebase entirely. Without it, you cannot log in.
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a Project**, name it (e.g., "DSDC MIS").
3. Click the **Web** icon (</>) to register the web app.
4. Copy the `firebaseConfig` object they give you. It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:1234:web:abcd"
   };
   ```
5. Open `c:\Users\HP\Desktop\DSDC MIS\js\app.js`.
6. Replace the `firebaseConfig` object at the very top of the file with your own.

**Enable Authentication:**
1. In Firebase Console, go to **Authentication** > **Sign-in method**.
2. Enable **Email/Password** (Email link is NOT required).

**Enable Firestore Database:**
1. In Firebase Console, go to **Firestore Database** > **Create database**.
2. Start in **Test mode** (or change rules to allow read/write).
   *(Note: For production, update rules to check if authenticated `request.auth != null`)*

---

### Step 2: Creating Admin and Centre Accounts

Users cannot sign up themselves (except candidates on the public page). Admin must create accounts.

1. Go to Firebase Console > Authentication > Users.
2. Click **Add User** and create an email/password.
3. Once created, copy the **User UID** string.
4. Go to Firestore Database > Create collection `users`.
5. Create a new document with the **Document ID** matching the **User UID**.
6. Add the following fields:
   * `role`: string (value: `admin` OR `centre`)
   * `email`: string (value: the email used above)

*Note: For Centres, when they log in for the first time, the system will force them to fill out the 3-step Centre Profile before proceeding!*

---

### Step 3: Google Sheets Backup (Optional but recommended)

The system is configured to send backup data to Google Sheets automatically when data is created.

1. Go to [Google Sheets](https://sheets.google.com/) and create a new blank spreadsheet.
2. Click **Extensions > Apps Script**.
3. Delete any code there, and copy paste EVERYTHING from the `google_sheet_script.js` file (located in your folder).
4. Click the **Save** icon (disk).
5. Click **Deploy > New deployment**.
6. Click the gear icon next to "Select type" and choose **Web app**.
   * Description: `DSDC MIS Backup`
   * Execute as: `Me (your email)`
   * Who has access: `Anyone` (Crucial!).
7. Click **Deploy**. (You will need to authorize access on your Google Account).
8. Copy the **Web app URL**.
9. Open `c:\Users\HP\Desktop\DSDC MIS\js\app.js`.
10. Find the line `const SHEET_BACKUP_URL = '';` and paste the exact URL inside the quotes.

---

### Getting Started

Once configured:
1. Double click `index.html` to open the website.
2. Click "Login".
3. Select "Admin" or "Centre Staff" depending on the account you manually made in Firebase.
4. From there, everything is fully functional!
