/**
 * DSDC MIS - Admin Functions
 * Consolidated from admin.html and admin-reports.html
 */

// Secondary Firebase App for creating users without logging out Admin
let secondaryAuth;
function initSecondaryAuth() {
    if (!secondaryAuth) {
        const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
        secondaryAuth = secondaryApp.auth();
    }
}

// --- Dashboard State ---
let allCentres = [], centreStats = {}, allBatches = [], allStudents = [], allFees = [], allTrainers = [], allCourses = [];

async function loadAdminDashboard() {
    showLoading();
    const now = new Date();
    const [cs, bs, ss, fs, ts, cos] = await Promise.all([
        db.collection('centres').get(),
        db.collection('batches').get(),
        db.collection('students').get(),
        db.collection('fees').get(),
        db.collection('trainers').get(),
        db.collection('courses').get()
    ]);

    allCentres = cs.docs.map(d => ({ id: d.id, ...d.data() }));
    allBatches = bs.docs.map(d => ({ id: d.id, ...d.data() }));
    allStudents = ss.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status === 'accepted');
    allFees = fs.docs.map(d => ({ id: d.id, ...d.data() }));
    allTrainers = ts.docs.map(d => ({ id: d.id, ...d.data() }));
    allCourses = cos.docs.map(d => ({ id: d.id, ...d.data() }));

    // Global stats
    let ongoing = 0, completed = 0, totalFees = 0;
    allBatches.forEach(b => {
        const s = b.startDate?.toDate?.() || new Date(b.startDate), e = b.endDate?.toDate?.() || new Date(b.endDate);
        if (s <= now && e >= now) ongoing++;
        if (e < now) completed++;
    });
    allFees.forEach(f => totalFees += Number(f.amount || 0));

    document.getElementById('gs-centres').textContent = allCentres.length;
    document.getElementById('gs-courses').textContent = allCourses.length;
    document.getElementById('gs-batches').textContent = allBatches.length;
    document.getElementById('gs-ongoing').textContent = ongoing;
    document.getElementById('gs-completed').textContent = completed;
    document.getElementById('gs-students').textContent = allStudents.length;
    document.getElementById('gs-fees').textContent = formatCurrency(totalFees);
    document.getElementById('gs-trainers').textContent = allTrainers.length;

    calculateAdminStats('all');
    renderAdminCentres();
    startClock();
    document.getElementById('admin-time-display').textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    hideLoading();
}

function setAdminTimeFilter(period, btn) {
    document.querySelectorAll('.t-filter-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
    btn.classList.add('active', 'btn-primary');
    calculateAdminStats(period);
    renderAdminCentres();
}

function calculateAdminStats(period) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const filterFn = (item) => {
        if (period === 'all') return true;
        const date = item.createdAt?.toDate?.() || item.paymentDate?.toDate?.() || new Date(item.createdAt || item.paymentDate || item.startDate);
        if (period === 'today') return date >= todayStart;
        if (period === 'month') return date >= monthStart;
        if (period === 'year') return date >= yearStart;
        return true;
    };

    allCentres.forEach(c => {
        const centreBatches = allBatches.filter(b => b.centreId === c.id);
        const centreStudents = allStudents.filter(s => s.centreId === c.id);
        const centreFees = allFees.filter(f => f.centreId === c.id);
        const centreTrainers = allTrainers.filter(t => t.centreId === c.id);
        const centreCourses = allCourses.filter(co => co.centreId === c.id);

        centreStats[c.id] = {
            batches: centreBatches.filter(filterFn).length,
            ongoing: centreBatches.filter(b => {
                const s = b.startDate?.toDate?.() || new Date(b.startDate);
                const e = b.endDate?.toDate?.() || new Date(b.endDate);
                return s <= now && e >= now && filterFn(b);
            }).length,
            completed: centreBatches.filter(b => {
                const e = b.endDate?.toDate?.() || new Date(b.endDate);
                return e < now && filterFn(b);
            }).length,
            students: centreStudents.filter(filterFn).length,
            fees: centreFees.filter(filterFn).reduce((a, f) => a + Number(f.amount || 0), 0),
            trainers: centreTrainers.filter(filterFn).length,
            courses: centreCourses.filter(filterFn).length
        };
    });
}

function renderAdminCentres() {
    const s = document.getElementById('centre-search').value.toLowerCase();
    const centres = allCentres.filter(c => !s || (c.centreName || '').toLowerCase().includes(s) || (c.contactName || '').toLowerCase().includes(s));
    const grid = document.getElementById('centres-grid');
    if (!centres.length) { grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted);">No centres found</div>'; return; }
    grid.innerHTML = centres.map((c, i) => {
        const st = centreStats[c.id] || {};
        const colors = ['purple', 'teal', 'pink', 'blue', 'orange', 'green'];
        const col = colors[i % colors.length];
        return `<div class="centre-card" onclick="viewCentreDetails('${c.id}')" style="border-left-color:var(--${col === 'purple' ? 'primary' : col === 'teal' ? 'secondary' : col === 'pink' ? 'accent' : col === 'blue' ? 'info' : col === 'orange' ? 'warning' : 'success'});">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div class="user-avatar" style="width:44px;height:44px;font-size:16px;">${initials(c.centreName || 'C')}</div>
        <div>
          <h4 style="font-weight:800;color:var(--text);font-size:15px;">${c.centreName || '—'}</h4>
          <p style="font-size:12px;color:var(--text-muted);">👤 BDE: ${c.contactName || '—'} • 📱 ${c.contactMobile || c.phone || '—'}</p>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">📍 ${(c.address || '').substring(0, 60)}${(c.address || '').length > 60 ? '...' : ''}</p>
      <div class="centre-stats-row">
        <div class="centre-stat"><h3>${st.courses || 0}</h3><p>Courses</p></div>
        <div class="centre-stat"><h3>${st.batches || 0}</h3><p>Batches</p></div>
        <div class="centre-stat"><h3>${st.students || 0}</h3><p>Students</p></div>
        <div class="centre-stat"><h3>${formatCurrency(st.fees || 0)}</h3><p>Fees</p></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        <span class="badge badge-success">🔄 ${st.ongoing || 0} Ongoing</span>
        <span class="badge badge-grey">✅ ${st.completed || 0} Completed</span>
        <span class="badge badge-info">🧑‍🏫 ${st.trainers || 0} Trainers</span>
      </div>
    </div>`;
    }).join('');
}

async function viewCentreDetails(id) {
    const c = allCentres.find(x => x.id === id);
    const st = centreStats[id] || {};
    if (!c) return;
    document.getElementById('cd-modal-title').textContent = c.centreName;
    const batches = allBatches.filter(b => b.centreId === id);
    const students = allStudents.filter(s => s.centreId === id);
    const fees = allFees.filter(f => f.centreId === id);
    document.getElementById('cd-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px;">
      <div>
        <div class="section-label" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--primary);margin-bottom:12px;">Centre Information</div>
        <div class="r-row"><span class="r-label">Centre Name</span><span class="r-value">${c.centreName}</span></div>
        <div class="r-row"><span class="r-label">Centre Code</span><span class="r-value">${c.branchCode || '—'}</span></div>
        <div class="r-row"><span class="r-label">Email</span><span class="r-value">${c.email || '—'}</span></div>
        <div class="r-row"><span class="r-label">Phone</span><span class="r-value">${c.phone || '—'}</span></div>
        <div class="r-row"><span class="r-label">Address</span><span class="r-value">${c.address || '—'}</span></div>
      </div>
      <div>
        <div class="section-label" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--primary);margin-bottom:12px;">BDE Information</div>
        <div class="r-row"><span class="r-label">BDE Name</span><span class="r-value">${c.contactName || '—'}</span></div>
        <div class="r-row"><span class="r-label">Designation</span><span class="r-value">${c.designation || '—'}</span></div>
        <div class="r-row"><span class="r-label">BDE Mobile</span><span class="r-value">${c.contactMobile || '—'}</span></div>
        <div class="r-row"><span class="r-label">Alt Contact</span><span class="r-value">${c.altContact || '—'}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      ${[['📚 Courses', st.courses || 0, 'purple'], ['👥 Batches', st.batches || 0, 'teal'], ['🎓 Students', st.students || 0, 'blue'], ['💰 Fees', formatCurrency(st.fees || 0), 'green']].map(([l, v, c]) => `
        <div class="stat-card ${c}" style="padding:14px;">
          <div><h3 style="font-size:20px;font-weight:800;color:var(--text);">${v}</h3><p style="font-size:11px;color:var(--text-muted);">${l}</p></div>
        </div>`).join('')}
    </div>
    <div>
      <div class="section-label" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--primary);margin-bottom:12px;">Recent Batches</div>
      ${batches.slice(-4).map(b => `<div class="activity-item"><div class="act-icon">👥</div><div class="act-info"><h4>${b.batchCode}</h4><p>${b.courseName} • ${formatDate(b.startDate)} → ${formatDate(b.endDate)}</p></div><span class="badge badge-${b.status === 'ongoing' ? 'success' : b.status === 'completed' ? 'grey' : 'info'}">${b.status || 'upcoming'}</span></div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;">No batches yet</p>'}
    </div>`;

    // Update footer with manage buttons
    document.getElementById('cd-modal-footer').innerHTML = `
    <button class="btn btn-outline" onclick="deleteAdminCentre('${c.id}')" style="margin-right:auto; color:#ef4444; border-color:#ef4444;">🗑️ Delete Centre</button>
    <button class="btn btn-warning btn-sm" onclick="changeCentrePassword('${c.branchCode || c.id}', '${c.centreName}')">🔑 Change Password</button>
    <button class="btn btn-ghost" onclick="closeModal('centre-detail-modal')">Close</button>
  `;
    openModal('centre-detail-modal');
}

async function deleteAdminCentre(id) {
    if(!confirm("Are you SURE you want to delete this centre? This will remove them from the dashboard.")) return;
    try {
        await db.collection('centres').doc(id).delete();
        await db.collection('users').doc(id).delete();
        showToast('Centre deleted successfully.', 'success');
        closeModal('centre-detail-modal');
        loadAdminDashboard();
    } catch(e) {
        showToast('Error deleting: ' + e.message, 'error');
    }
}

function openCreateCentreModal() {
    document.getElementById('centre-form').reset();
    document.getElementById('form-modal-title').textContent = 'Create New Centre';
    document.getElementById('save-centre-btn').textContent = 'Create Centre';
    openModal('centre-form-modal');
}

async function saveAdminCentre() {
    const name = document.getElementById('f-name').value.trim();
    const username = document.getElementById('f-username').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const pass = document.getElementById('f-pass').value.trim();
    const btn = document.getElementById('save-centre-btn');

    if (!name || !username || !email || (pass.length < 6)) {
        showToast('Name, Username, and Email required, password must be 6+ chars.', 'error');
        return;
    }

    btn.disabled = true; btn.textContent = 'Creating...';

    initSecondaryAuth();

    try {
        // 1. Create Auth Account using secondary instance
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
        const uid = cred.user.uid;
        secondaryAuth.signOut(); // Clean up

        // 2. Create User Profile
        await db.collection('users').doc(uid).set({ email, role: 'centre' });

        // 3. Create Centre Profile
        await db.collection('centres').doc(uid).set({
            centreName: name,
            branchCode: username,
            setupComplete: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 4. Append to Passwords sheet
        try {
            fetch(SHEET_BACKUP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    sheet: 'Passwords',
                    action: 'appendRow',
                    rows: [{
                        Name: name,
                        Username: username,
                        Password: pass
                    }]
                })
            });
        } catch(e) { console.warn('Could not add to Passwords sheet', e); }

        showToast('Centre created successfully!', 'success');
        closeModal('centre-form-modal');
        loadAdminDashboard(); // Refresh
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        btn.disabled = false; btn.textContent = 'Create Centre';
    }
}

async function resetAdminUserPassword(email) {
    if (!confirm(`Send password reset link to ${email}?`)) return;
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Reset email sent!', 'info');
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function exportAdminAllData() {
    const wb = XLSX.utils.book_new();
    const addSheet = (name, data) => { const ws = XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, name); };
    addSheet('Centres', allCentres.map(c => ({ Name: c.centreName, Address: c.address, Phone: c.phone, Email: c.email, Contact: c.contactName, Mobile: c.contactMobile })));
    addSheet('Batches', allBatches.map(b => ({ Batch: b.batchCode, Course: b.courseName, Centre: allCentres.find(c => c.id === b.centreId)?.centreName || '', Trainer: b.trainerName, Start: formatDate(b.startDate), End: formatDate(b.endDate), Status: b.status })));
    addSheet('Students', allStudents.map(s => ({ Name: s.name, Mobile: s.mobile, Email: s.email, Course: s.courseName, Batch: s.batchCode, Centre: allCentres.find(c => c.id === s.centreId)?.centreName || '', Status: s.status })));
    addSheet('Fees', allFees.map(f => ({ Receipt: f.receiptNo, Student: f.studentName, Amount: f.amount, Mode: f.paymentMode, Date: formatDate(f.paymentDate || f.createdAt), Centre: f.centreName })));
    XLSX.writeFile(wb, `DSDC_Complete_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Full report exported!', 'success');
}

// --- Reports Logic (from admin-reports.html) ---
let currentAdminReport = 'trainers';
let allAdminData = { centres: [], trainers: [], courses: [], batches: [], students: [], fees: [] };
let currentAdminRows = [];

async function loadAdminReportsPage() {
    showLoading();
    startClock();
    const [ce, tr, co, ba, st, fe] = await Promise.all([
        db.collection('centres').get(),
        db.collection('trainers').get(),
        db.collection('courses').get(),
        db.collection('batches').get(),
        db.collection('students').get(),
        db.collection('fees').get()
    ]);

    allAdminData.centres = ce.docs.map(d => ({ id: d.id, ...d.data() }));
    allAdminData.trainers = tr.docs.map(d => ({ id: d.id, ...d.data() }));
    allAdminData.courses = co.docs.map(d => ({ id: d.id, ...d.data() }));
    allAdminData.batches = ba.docs.map(d => ({ id: d.id, ...d.data() }));
    allAdminData.students = st.docs.map(d => ({ id: d.id, ...d.data() }));
    allAdminData.fees = fe.docs.map(d => ({ id: d.id, ...d.data() }));

    // Populate filter selects
    const rfCentre = document.getElementById('rf-centre');
    const rfCourse = document.getElementById('rf-course');
    if(rfCentre) {
        rfCentre.innerHTML = '<option value="">All Centres</option>';
        allAdminData.centres.forEach(c => rfCentre.innerHTML += `<option value="${c.id}">${c.centreName}</option>`);
    }
    
    if(rfCourse) {
        rfCourse.innerHTML = '<option value="">All Courses</option>';
        const uniqueCourses = [...new Map(allAdminData.courses.map(item => [item.name, item])).values()];
        uniqueCourses.forEach(c => rfCourse.innerHTML += `<option value="${c.name}">${c.name}</option>`);
    }

    hideLoading();
    runAdminReport();
}

function getAdminCentreName(id) {
    const centre = allAdminData.centres.find(c => c.id === id);
    return centre ? centre.centreName : '—';
}

function selectAdminReport(type, el) {
    currentAdminReport = type;
    document.querySelectorAll('.report-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    // Show/hide filters
    const showCourse = ['batches', 'all-students'].includes(type);
    const showStatus = ['all-students'].includes(type);
    const showFees = ['all-students'].includes(type);
    const showDates = ['fees', 'all-students', 'batches'].includes(type);
    
    const fcw = document.getElementById('f-course-wrap');
    const fsw = document.getElementById('f-status-wrap');
    const ffw = document.getElementById('f-fees-wrap');
    const ffwrd = document.getElementById('f-from-wrap');
    const ftw = document.getElementById('f-to-wrap');
    const exb = document.getElementById('export-btn');

    if(fcw) fcw.style.display = showCourse ? 'block' : 'none';
    if(fsw) fsw.style.display = showStatus ? 'block' : 'none';
    if(ffw) ffw.style.display = showFees ? 'block' : 'none';
    if(ffwrd) ffwrd.style.display = showDates ? 'block' : 'none';
    if(ftw) ftw.style.display = showDates ? 'block' : 'none';
    if(exb) exb.style.display = 'flex';
    
    runAdminReport();
}

function clearAdminRFilters() {
    ['rf-centre', 'rf-course', 'rf-status', 'rf-fees', 'rf-from', 'rf-to', 'rf-search'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    runAdminReport();
}

function runAdminReport() {
    const searchEl = document.getElementById('rf-search');
    const centreFilterEl = document.getElementById('rf-centre');
    const courseNameEl = document.getElementById('rf-course');
    const statusEl = document.getElementById('rf-status');
    const feesFilterEl = document.getElementById('rf-fees');
    const fromEl = document.getElementById('rf-from');
    const toEl = document.getElementById('rf-to');

    if(!searchEl) return; // Not on reports page

    const search = searchEl.value.toLowerCase();
    const centreFilterId = centreFilterEl.value;
    const courseName = courseNameEl.value;
    const status = statusEl.value;
    const feesFilter = feesFilterEl.value;
    const from = fromEl.value;
    const to = toEl.value;

    let headers = [], rows = [], extraInfo = '';

    if (currentAdminReport === 'trainers') {
        headers = ['#', 'Centre', 'Name', 'Mobile', 'Email', 'Specialization', 'Qualification', 'Experience'];
        let data = allAdminData.trainers;
        if (centreFilterId) data = data.filter(t => t.centreId === centreFilterId);
        if (search) data = data.filter(t => (t.name || '').toLowerCase().includes(search));

        currentAdminRows = data.map(t => ({ 'Centre': getAdminCentreName(t.centreId), 'Name': t.name, 'Mobile': t.mobile, 'Email': t.email, 'Specialization': t.specialization, 'Qualification': t.qualification, 'Experience': t.experience }));

        rows = data.map((t, i) => [
            i + 1,
            adminBadge('primary', getAdminCentreName(t.centreId)),
            `<strong>${t.name}</strong>`,
            t.mobile,
            t.email || '—',
            t.specialization,
            t.qualification || '—',
            (t.experience || 0) + ' yrs'
        ]);

    } else if (currentAdminReport === 'courses') {
        headers = ['#', 'Centre', 'Course Name', 'QP Code', 'Sector', 'Total Days', 'Status'];
        let data = allAdminData.courses;
        if (centreFilterId) data = data.filter(c => c.centreId === centreFilterId);
        if (search) data = data.filter(c => (c.name || '').toLowerCase().includes(search) || (c.qpCode || '').toLowerCase().includes(search));

        currentAdminRows = data.map(c => ({ 'Centre': getAdminCentreName(c.centreId), 'Name': c.name, 'QP Code': c.qpCode, 'Sector': c.sector, 'Total Days': c.totalDays, 'Status': c.status }));

        rows = data.map((c, i) => [
            i + 1,
            adminBadge('primary', getAdminCentreName(c.centreId)),
            `<strong>${c.name}</strong>`,
            adminBadge('info', c.qpCode || '—'),
            c.sector || '—',
            c.totalDays || '—',
            adminBadge(c.status === 'active' ? 'success' : 'grey', c.status)
        ]);

    } else if (currentAdminReport === 'batches') {
        headers = ['#', 'Centre', 'Batch Code', 'Course', 'Trainer', 'Start Date', 'End Date', 'Status'];
        let data = allAdminData.batches;
        if (centreFilterId) data = data.filter(b => b.centreId === centreFilterId);
        if (courseName) data = data.filter(b => b.courseName === courseName);
        if (from) data = data.filter(b => new Date(b.startDate?.toDate?.() || b.startDate) >= new Date(from));
        if (to) data = data.filter(b => new Date(b.startDate?.toDate?.() || b.startDate) <= new Date(to));
        if (search) data = data.filter(b => (b.batchCode || '').toLowerCase().includes(search) || (b.courseName || '').toLowerCase().includes(search));

        currentAdminRows = data.map(b => ({ 'Centre': getAdminCentreName(b.centreId), 'Batch Code': b.batchCode, 'Course': b.courseName, 'Trainer': b.trainerName, 'Start': formatDate(b.startDate), 'End': formatDate(b.endDate), 'Status': b.status }));

        rows = data.map((b, i) => [
            i + 1,
            adminBadge('primary', getAdminCentreName(b.centreId)),
            `<strong>${b.batchCode}</strong>`,
            b.courseName || '—',
            b.trainerName || '—',
            formatDate(b.startDate),
            formatDate(b.endDate),
            adminBadge(b.status === 'ongoing' ? 'success' : b.status === 'completed' ? 'grey' : 'info', b.status || 'upcoming')
        ]);

    } else if (currentAdminReport === 'all-students') {
        headers = ['#', 'Centre', 'Name', 'Mobile', 'Course', 'Batch', 'Status', 'Fees Paid'];
        let students = allAdminData.students;
        if (centreFilterId) students = students.filter(s => s.centreId === centreFilterId);
        if (courseName) students = students.filter(s => s.courseName === courseName);
        if (status) students = students.filter(s => s.status === status);
        if (search) students = students.filter(s => (s.name || '').toLowerCase().includes(search) || (s.mobile || '').includes(search));
        if (feesFilter) {
            const paidIds = new Set(allAdminData.fees.map(f => f.studentId));
            if (feesFilter === 'paid') students = students.filter(s => paidIds.has(s.id));
            if (feesFilter === 'unpaid') students = students.filter(s => !paidIds.has(s.id));
        }

        currentAdminRows = students.map(s => {
            const paid = allAdminData.fees.filter(f => f.studentId === s.id).reduce((a, f) => a + Number(f.amount), 0);
            return { 'Centre': getAdminCentreName(s.centreId), 'Name': s.name, 'Mobile': s.mobile, 'Email': s.email, 'Course': s.courseName, 'Batch': s.batchCode, 'Status': s.status, 'Fees Paid(₹)': paid };
        });

        rows = students.map((s, i) => {
            const paid = allAdminData.fees.filter(f => f.studentId === s.id).reduce((a, f) => a + Number(f.amount), 0);
            return [
                i + 1,
                adminBadge('primary', getAdminCentreName(s.centreId)),
                `<strong>${s.name}</strong>`,
                s.mobile || '—',
                s.courseName || '—',
                s.batchCode || '—',
                adminBadge(s.status === 'accepted' ? 'success' : s.status === 'rejected' ? 'danger' : 'warning', s.status),
                `<strong>${formatCurrency(paid)}</strong>`
            ];
        });

    } else if (currentAdminReport === 'fees') {
        headers = ['#', 'Centre', 'Receipt No.', 'Student', 'Course', 'Amount', 'Mode', 'Date'];
        let data = allAdminData.fees;
        if (centreFilterId) data = data.filter(f => f.centreId === centreFilterId);
        if (from) data = data.filter(f => new Date(f.paymentDate?.toDate?.() || f.paymentDate) >= new Date(from));
        if (to) data = data.filter(f => new Date(f.paymentDate?.toDate?.() || f.paymentDate) <= new Date(to + 'T23:59'));
        if (search) data = data.filter(f => (f.studentName || '').toLowerCase().includes(search));

        const total = data.reduce((a, f) => a + Number(f.amount), 0);
        extraInfo = `Total Collected: <strong>${formatCurrency(total)}</strong>`;

        currentAdminRows = data.map(f => ({
            'Centre': getAdminCentreName(f.centreId),
            'Receipt': f.receiptNo,
            'Student': f.studentName,
            'Course': f.courseName,
            'Amount': f.amount,
            'Mode': f.paymentMode,
            'Date': formatDate(f.paymentDate || f.createdAt)
        }));

        rows = data.map((f, i) => [
            i + 1,
            adminBadge('primary', getAdminCentreName(f.centreId)),
            adminBadge('grey', f.receiptNo || '—'),
            f.studentName || '—',
            f.courseName || '—',
            `<strong>${formatCurrency(f.amount)}</strong>`,
            f.paymentMode || '—',
            formatDate(f.paymentDate || f.createdAt)
        ]);
    }

    const sumBar = document.getElementById('report-summary');
    if(sumBar) {
        sumBar.style.display = 'flex';
        document.getElementById('rs-count').textContent = currentAdminRows.length;
        document.getElementById('rs-extra').innerHTML = extraInfo;
    }
    
    renderAdminReportTable(headers, rows);
}

function adminBadge(type, text) { return `<span class="badge badge-${type}">${text}</span>`; }

function renderAdminReportTable(headers, rows) {
    const thead = document.getElementById('report-thead');
    const tbody = document.getElementById('report-tbody');
    if(!thead || !tbody) return;

    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="${headers.length}" class="table-empty">No data found</td></tr>`; return; }
    tbody.innerHTML = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
}

function exportCurrentAdminReport() {
    if (!currentAdminRows.length) { showToast('No data to export.', 'warning'); return; }
    exportToExcel(currentAdminRows, `Global_Report_${currentAdminReport}_${new Date().toISOString().split('T')[0]}`);
}

// ==========================================
// CUSTOM GOOGLE SHEET PASSWORD MANAGEMENT
// ==========================================

async function changeCentrePassword(username, centreName) {
    if (!username) {
        showToast('Centre has no branch code/username set.', 'error');
        return;
    }
    
    const newPassword = prompt(`Enter new password for ${centreName} (Username: ${username}):`);
    if (!newPassword || !newPassword.trim()) return;
    
    // Check length just in case
    if (newPassword.trim().length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return;
    }
    
    showToast('Updating password...', 'info');
    
    try {
        await updateUserPassword(username, newPassword.trim());
        showToast('Password updated successfully in Google Sheet!', 'success');
    } catch (e) {
        showToast('Error updating password: ' + e.message, 'error');
    }
}

async function updateUserPassword(username, newPassword) {
    showLoading();
    try {
        await fetch(SHEET_BACKUP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                sheet: 'Passwords',
                action: 'updatePassword',
                username: username,
                newPassword: newPassword
            })
        });
        
        // Because of no-cors, we assume success if no network error
        if (typeof allPasswordsList !== 'undefined' && allPasswordsList && allPasswordsList.length > 0) {
            const uKeys = Object.keys(allPasswordsList[0]);
            const unameKey = uKeys.find(k => k.trim().toLowerCase() === 'username');
            const passKey = uKeys.find(k => k.trim().toLowerCase() === 'password');
            if (unameKey && passKey) {
                const user = allPasswordsList.find(u => String(u[unameKey] || '') === username);
                if (user) user[passKey] = newPassword;
            }
        }
        hideLoading();
    } catch (e) {
        hideLoading();
        throw e;
    }
}

// Old Manage Passwords modal logic removed as requested
