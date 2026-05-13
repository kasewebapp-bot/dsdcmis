// ===== DSDC MIS - Firebase Configuration =====
// Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCtAcpqoOij1_IQAiqEI6mxX0_sGTJlbPg",
  authDomain: "kasemisfree.firebaseapp.com",
  projectId: "kasemisfree",
  storageBucket: "kasemisfree.firebasestorage.app",
  messagingSenderId: "1039198073788",
  appId: "1:1039198073788:web:5e6b0e099cfbf109d071b9"
};

const LOGO_URL = 'https://res.cloudinary.com/dohsh2sal/image/upload/v1773303953/copy_of_district_skill_o5cnkk_47abf0.png';
const ADMIN_PASSWORD = 'Admin921';

// Centre short codes used for login (username = code)
const CENTRE_CODES = [
  "DSDCPTA",
  "DSDCTVM",
  "DSDCKLM",
  "DSDCKZD",
  "DSDCPKD",
  "DSDCKSD"
];

// Maps short code → Firebase Auth email (original registration email format)
const CENTRE_EMAIL_MAP = {
  "DSDCPTA": "dsdc_pathanamthitta@dsdc.com",
  "DSDCTVM": "dsdc_thiruvananthapuram@dsdc.com",
  "DSDCKLM": "dsdc_kollam@dsdc.com",
  "DSDCKZD": "dsdc_kozhikkode@dsdc.com",
  "DSDCPKD": "dsdc_palakkad@dsdc.com",
  "DSDCKSD": "dsdc_kasargode@dsdc.com"
};

// Legacy alias (kept for any pages that still reference CENTRES_LIST)
const CENTRES_LIST = CENTRE_CODES;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Fix for local file:/// access issues in some browsers
db.settings({ experimentalForceLongPolling: true });

// ===== AUTH HELPERS =====
async function getCurrentUser() {
  const user = localStorage.getItem('dsdc_user');
  const role = localStorage.getItem('dsdc_role');
  const uid = localStorage.getItem('dsdc_uid'); // For centres
  if (user && role) {
    return { uid: uid || user, email: user + '@dsdc.com', role: role, username: user };
  }
  return null;
}

async function getUserRole(uid) {
  const role = localStorage.getItem('dsdc_role');
  if (role) {
      return { role: role };
  }
  return null;
}

async function requireAuth(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) { window.top.location.href = 'login.html'; return null; }
  const userData = await getUserRole(user.uid);
  if (!userData) { logout(); return null; }
  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    window.top.location.href = 'login.html'; return null;
  }
  return { user, userData };
}

async function logout() {
  localStorage.removeItem('dsdc_user');
  localStorage.removeItem('dsdc_role');
  localStorage.removeItem('dsdc_uid');
  localStorage.removeItem('dsdc_trainer_id');
  localStorage.removeItem('dsdc_trainer_centre');
  window.top.location.href = 'login.html';
}

// ===== FIRESTORE HELPERS =====
function serverTime() { return firebase.firestore.FieldValue.serverTimestamp(); }

async function addDoc(collection, data) {
  const payload = { ...data, createdAt: serverTime(), updatedAt: serverTime() };
  const res = await db.collection(collection).add(payload);
  // Backup in background
  backupToSheet(collection, [{ id: res.id, ...payload }]);
  return res;
}

async function setDoc(collection, id, data) {
  const payload = { ...data, updatedAt: serverTime() };
  const res = await db.collection(collection).doc(id).set(payload, { merge: true });
  // Backup in background
  backupToSheet(collection, [{ id, ...payload }]);
  return res;
}

async function getDoc(collection, id) {
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getDocs(collection, ...constraints) {
  let ref = db.collection(collection);
  for (const c of constraints) ref = ref.where(c[0], c[1], c[2]);
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateDoc(collection, id, data) {
  const res = await db.collection(collection).doc(id).update({ ...data, updatedAt: serverTime() });
  // Fetch full doc for backup to ensure data integrity
  getDoc(collection, id).then(doc => { if (doc) backupToSheet(collection, [doc]); });
  return res;
}

async function deleteDoc(collection, id) {
  // We don't necessarily delete from sheets, or we could mark as deleted
  return db.collection(collection).doc(id).delete();
}

// ===== GOOGLE SHEETS BACKUP =====
const SHEET_BACKUP_URL = 'https://script.google.com/macros/s/AKfycbyT4YtXV_GdzMTGwND1UpP1Jd8agq2tI5GPCHVVc5hSn-b69fR5RY9xchFNFty5imI/exec'; // Add your Google Apps Script URL here

async function backupToSheet(sheetName, rows) {
  if (!SHEET_BACKUP_URL || !rows || rows.length === 0) return;
  try {
    // Format rows: convert timestamps to ISO strings
    const formattedRows = rows.map(row => {
      const clean = { ...row };
      for (const k in clean) {
        if (clean[k] && typeof clean[k].toDate === 'function') {
          clean[k] = clean[k].toDate().toISOString();
        } else if (clean[k] instanceof Date) {
          clean[k] = clean[k].toISOString();
        }
      }
      return clean;
    });

    await fetch(SHEET_BACKUP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' }, // Using text/plain to stay in "simple request" for no-cors
      body: JSON.stringify({ sheet: sheetName, rows: formattedRows })
    });
  } catch (e) { console.warn('Sheet backup failed:', e); }
}

// ===== UTILITY FUNCTIONS =====
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split('T')[0];
}

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function generateId(prefix = '') {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

// ===== TOAST SYSTEM =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}-toast`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><p>${message}</p>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== MODAL SYSTEM =====
function openModal(id) {
  document.getElementById(id)?.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
  document.body.style.overflow = '';
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// ===== HEADER CLOCK =====
function startClock() {
  const el = document.getElementById('header-time');
  if (!el) return;
  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
      ' | ' + now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  update();
  setInterval(update, 1000);
}

// ===== TABS =====
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      if (!target) return;
      const tabGroup = btn.closest('[data-tabs]') || btn.parentElement.parentElement;
      tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
    });
  });
}

// ===== LOADING =====
function showLoading() {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

// ===== EXCEL EXPORT =====
function exportToExcel(data, filename) {
  // Uses SheetJS library loaded from CDN
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename + '.xlsx');
}

// ===== HIGHLIGHT ACTIVE NAV =====
function highlightActiveNav() {
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    const link = item.querySelector('a');
    if (link && link.getAttribute('href') === page) item.classList.add('active');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  startClock();
  initTabs();
  highlightActiveNav();
});
