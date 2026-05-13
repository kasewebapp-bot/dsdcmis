/**
 * DSDC MIS - Centre Functions
 * Consolidated from various centre-related HTML files
 */

// --- Shared State ---
let centreId = '', centreData = null;
let allCoursesList = [], allBatchesList = [], allStudentsList = [], allFeesList = [], allAttendanceList = [];

// --- Page: centre-portal.html ---
async function initCentrePortal() {
    const ctx = await initPage('Portal');
    if (!ctx) return;
    
    const iframe = document.getElementById('main-iframe');
    if (iframe) {
        iframe.addEventListener('load', () => {
            try {
                const path = iframe.contentWindow.location.pathname.split('/').pop();
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                
                document.querySelectorAll('.nav-item').forEach(item => {
                    const link = item.querySelector('a');
                    if (link && link.getAttribute('href') === path || (path === '' && link.getAttribute('href') === 'dashboard.html')) {
                        item.classList.add('active');
                    }
                });
            } catch(e) {}
        });
    }
}

// --- Page: dashboard.html ---
async function loadCentreDashboard() {
    const ctx = await initPage('Dashboard');
    if (!ctx) return;
    centreData = ctx.centreData;
    centreId = ctx.session.user.uid;

    const welcomeMsg = document.getElementById('welcome-msg');
    const centreNameDisplay = document.getElementById('centre-name-display');
    if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${centreData.contactName || 'Centre Incharge'}! 👋`;
    if (centreNameDisplay) centreNameDisplay.textContent = centreData.centreName;

    const [courses, batches, students, fees] = await Promise.all([
        db.collection('courses').where('centreId', '==', centreId).get(),
        db.collection('batches').where('centreId', '==', centreId).get(),
        db.collection('students').where('centreId', '==', centreId).get(),
        db.collection('fees').where('centreId', '==', centreId).get(),
    ]);

    allCoursesList = courses.docs.map(d => ({ id: d.id, ...d.data() }));
    allBatchesList = batches.docs.map(d => ({ id: d.id, ...d.data() }));
    allStudentsList = students.docs.map(d => ({ id: d.id, ...d.data() }));
    allFeesList = fees.docs.map(d => ({ id: d.id, ...d.data() }));

    // Cache for public registration page fallback
    localStorage.setItem('dsdc_courses_cache', JSON.stringify(allCoursesList));
    localStorage.setItem('dsdc_batches_cache', JSON.stringify(allBatchesList));

    updateCentreDashboardStats('all');
    renderCentreRecentActivity();
}

function setCentreDashboardFilter(period, btn) {
    document.querySelectorAll('.t-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
    });
    btn.classList.add('active');
    btn.style.background = 'rgba(255,255,255,0.25)';
    updateCentreDashboardStats(period);
}

function updateCentreDashboardStats(period) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());

    const filterFn = (item) => {
        if (period === 'all') return true;
        const date = item.createdAt?.toDate?.() || item.paymentDate?.toDate?.() || new Date(item.createdAt || item.paymentDate || item.startDate);
        if (period === 'today') return date >= todayStart;
        if (period === 'week') return date >= weekStart;
        if (period === 'month') return date >= monthStart;
        if (period === 'year') return date >= yearStart;
        return true;
    };

    const filteredCourses = allCoursesList.filter(filterFn);
    const filteredBatches = allBatchesList.filter(filterFn);
    const filteredStudents = allStudentsList.filter(filterFn);
    const filteredFees = allFeesList.filter(filterFn);

    let ongoing = 0; let upcoming = 0; let completed = 0;
    filteredBatches.forEach(b => {
        if (b.status === 'upcoming') upcoming++;
        else if (b.status === 'completed') completed++;
        else if (b.status === 'ongoing') ongoing++;
        else {
            // Fallback for older data without exact status string
            const s = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
            const e = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate);
            if (s <= today && e >= today) ongoing++;
            else if (s > today) upcoming++;
            else if (e < today) completed++;
        }
    });

    let pendingCount = 0;
    let totalFees = 0;
    filteredStudents.forEach(s => { if (s.status === 'pending') pendingCount++; });
    filteredFees.forEach(f => { totalFees += Number(f.amount || 0); });

    // Update SPA Stats
    const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

    const acceptedStudentsCount = filteredStudents.filter(s => s.status === 'accepted').length;

    updateText('s-courses', filteredCourses.length);
    updateText('s-batches', filteredBatches.length);
    updateText('s-ongoing', ongoing);
    updateText('s-upcoming', upcoming);
    updateText('s-completed', completed);
    updateText('s-students', acceptedStudentsCount);
    updateText('s-pending', pendingCount);
    updateText('s-fees', formatCurrency(totalFees));
    
    // New SPA specific IDs if different
    updateText('s-total-students', acceptedStudentsCount);
    updateText('s-active-batches', ongoing);
    updateText('s-total-courses', filteredCourses.length);
    updateText('s-fees-collected', formatCurrency(totalFees));
}

function renderCentreRecentActivity() {
    const rb = document.getElementById('recent-batches-list') || document.getElementById('recent-batches');
    const ps = document.getElementById('recent-students-list') || document.getElementById('pending-students');
    
    if (rb) {
        const batchArr = allBatchesList.slice(-4).reverse();
        if (batchArr.length > 0) {
            rb.innerHTML = batchArr.map(d => {
                const statusClass = d.status === 'ongoing' ? 'success' : (d.status === 'completed' ? 'grey' : 'info');
                return `<div class="activity-item">
                    <div class="act-icon">👥</div>
                    <div class="act-info">
                        <h4>${d.batchCode || 'Batch'} — ${d.courseName || ''}</h4>
                        <p>${formatDate(d.startDate)} → ${formatDate(d.endDate)}</p>
                    </div>
                    <span class="badge badge-${statusClass}">${d.status || 'upcoming'}</span>
                </div>`;
            }).join('');
        } else {
            rb.innerHTML = '<div class="text-center py-4 text-muted">No recent batches</div>';
        }
    }

    if (ps) {
        const pendArr = allStudentsList.filter(s => s.status === 'pending').slice(0, 4);
        if (pendArr.length > 0) {
            ps.innerHTML = pendArr.map(d => {
                return `<div class="activity-item">
                    <div class="act-icon">🎓</div>
                    <div class="act-info">
                        <h4>${d.name}</h4>
                        <p>${d.courseName || d.course || ''} • ${d.mobile || ''}</p>
                    </div>
                    <button onclick="reviewStudentDetails('${d.id}'); navigatePortal('students');" class="btn btn-primary btn-sm">Review</button>
                </div>`;
            }).join('');
        } else {
            ps.innerHTML = '<div class="text-center py-4 text-muted">No pending requests 🎉</div>';
        }
    }
}

// --- Page: students.html ---
let currentSelectedStudentId = '';

async function loadStudentsPage() {
    const ctx = await initPage('Students');
    if (!ctx) return;
    centreId = ctx.session.user.uid;

    const [cs, bs] = await Promise.all([
        db.collection('courses').where('centreId', '==', centreId).get(),
        db.collection('batches').where('centreId', '==', centreId).get()
    ]);
    allCoursesList = cs.docs.map(d => ({ id: d.id, ...d.data() }));
    allBatchesList = bs.docs.map(d => ({ id: d.id, ...d.data() }));

    ['st-course', 'na-course', 'sp-course'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = (id === 'sp-course') ? '<option value="">All</option>' : '<option value="">-- Select Course --</option>';
        allCoursesList.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    });
    ['st-batch', 'na-batch', 'sa-batch'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = (id === 'sa-batch') ? '<option value="">All Batches</option>' : '<option value="">-- Select Batch --</option>';
        allBatchesList.forEach(b => sel.innerHTML += `<option value="${b.id}">${b.batchCode} — ${b.courseName}</option>`);
    });

    db.collection('students').where('centreId', '==', centreId).onSnapshot(snap => {
        allStudentsList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        renderPendingStudents();
        renderAllStudents();
        const pcCount = document.getElementById('pending-count');
        if (pcCount) pcCount.textContent = allStudentsList.filter(s => s.status === 'pending').length;
    });
}

function renderPendingStudents() {
    const sSearch = document.getElementById('sp-search');
    const sCourse = document.getElementById('sp-course');
    if (!sSearch || !sCourse) return;
    
    const search = sSearch.value.toLowerCase();
    const courseId = sCourse.value;
    const data = allStudentsList.filter(st => st.status === 'pending' && (!search || (st.name || '').toLowerCase().includes(search) || (st.mobile || '').includes(search)) && (!courseId || st.courseId === courseId));
    const tbody = document.getElementById('pending-tbody');
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No pending requests 🎉</td></tr>'; return; }
    tbody.innerHTML = data.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><a href="javascript:void(0)" onclick="viewStudentFullDetails('${s.id}')" style="font-weight:700;color:var(--primary);text-decoration:none;">${s.name}</a></td>
      <td>${s.mobile || '—'}</td><td>${s.email || '—'}</td>
      <td>${s.courseName || getCourseNameById(s.courseId)}</td>
      <td>${s.qualification || '—'}</td>
      <td>${formatDate(s.createdAt)}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-primary btn-sm" onclick="reviewStudentDetails('${s.id}')">👁️ Review</button>
        <button class="btn btn-success btn-sm" onclick="quickStudentStatus('${s.id}','accepted')">✅</button>
        <button class="btn btn-danger btn-sm" onclick="quickStudentStatus('${s.id}','rejected')">❌</button>
      </td>
    </tr>`).join('');
}

function renderAllStudents() {
    const saSearch = document.getElementById('sa-search');
    const saBatch = document.getElementById('sa-batch');
    if (!saSearch || !saBatch) return;

    const search = saSearch.value.toLowerCase();
    const batchId = saBatch.value;
    const data = allStudentsList.filter(x =>
        x.status === 'accepted' &&
        (!search || (x.name || '').toLowerCase().includes(search) || (x.mobile || '').includes(search)) &&
        (!batchId || x.batchId === batchId)
    );
    const tbody = document.getElementById('all-tbody');
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No students found</td></tr>'; return; }
    tbody.innerHTML = data.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><a href="javascript:void(0)" onclick="viewStudentFullDetails('${s.id}')" style="font-weight:700;color:var(--primary);text-decoration:none;">${s.name}</a>${s.aadhar ? `<br/><small style="color:var(--text-muted)">🪪 ${s.aadhar}</small>` : ''}</td>
      <td>${s.mobile || '—'}</td><td>${s.email || '—'}</td>
      <td>${s.courseName || getCourseNameById(s.courseId)}</td>
      <td>${getBatchCodeById(s.batchId)}</td>
      <td><span class="badge badge-${s.status === 'accepted' ? 'success' : s.status === 'rejected' ? 'danger' : 'warning'}">${s.status || 'pending'}</span></td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="reviewStudentDetails('${s.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteStudentRecord('${s.id}')">🗑️</button>
      </td>
    </tr>`).join('');
}

function getCourseNameById(id) { return allCoursesList.find(c => c.id === id)?.name || '—'; }
function getBatchCodeById(id) { if (!id) return '—'; return allBatchesList.find(b => b.id === id)?.batchCode || '—'; }
function clearStudentFilters() { 
    const saS = document.getElementById('sa-search');
    const saB = document.getElementById('sa-batch');
    if (saS) saS.value = ''; 
    if (saB) saB.value = ''; 
    renderAllStudents(); 
}

async function viewStudentFullDetails(id) {
    const s = allStudentsList.find(x => x.id === id);
    if (!s) return;
    
    const mBody = document.getElementById('full-student-modal-body');
    if(mBody) {
        mBody.innerHTML = `
        <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
            <div style="flex:1;min-width:300px;">
                <h3 style="margin-bottom:10px;">${s.name} <span class="badge badge-${s.status==='accepted'?'success':(s.status==='rejected'?'danger':'warning')}">${s.status || 'pending'}</span></h3>
                <p><strong>Mobile:</strong> ${s.mobile || '—'}  |  <strong>Email:</strong> ${s.email || '—'}</p>
                <p><strong>Aadhar:</strong> ${s.aadhar || '—'}  |  <strong>Gender:</strong> ${s.gender || '—'}</p>
                <p><strong>Address:</strong> ${[s.houseName, s.place, s.postOffice, s.district].filter(Boolean).join(', ') || '—'}</p>
                <h4 style="margin-top:16px; margin-bottom:8px;">Education & Enrollment</h4>
                <p><strong>Course:</strong> ${s.courseName || getCourseNameById(s.courseId)}</p>
                <p><strong>Batch:</strong> ${getBatchCodeById(s.batchId)}</p>
                <p><strong>Qualification:</strong> ${s.qualification || '—'} ${s.specialization ? `(${s.specialization})` : ''}</p>
                <p style="margin-top:8px;font-size:12px;color:var(--text-muted)">Joined: ${formatDate(s.createdAt)}</p>
            </div>
            <div style="flex:1;min-width:300px;background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:15px;">
                <h4 style="margin-bottom:10px;display:flex;justify-content:space-between;">
                    Fee History
                    <button class="btn btn-primary btn-sm" onclick="closeModal('student-full-modal'); navigatePortal('fees'); setTimeout(()=>document.getElementById('f-student').value='${s.id}', 300)">+ Collect</button>
                </h4>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Rcpt</th><th>Amount</th><th>Method</th></tr></thead>
                        <tbody id="student-fees-history">
                            <tr><td colspan="4" class="table-empty">Loading fees...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }
    openModal('student-full-modal');
    
    try {
        const snap = await db.collection('fees').where('studentId', '==', id).get();
        const feesData = snap.docs.map(d => d.data()).sort((a,b)=>(b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
        const fBody = document.getElementById('student-fees-history');
        if(fBody) {
            if(!feesData.length) {
                fBody.innerHTML = '<tr><td colspan="4" class="table-empty">No fee records found.</td></tr>';
            } else {
                fBody.innerHTML = feesData.map(f => `
                    <tr>
                        <td style="font-size:12px;">${f.paymentDate ? formatDate(f.paymentDate) : formatDate(f.createdAt)}</td>
                        <td style="font-size:12px;">${f.receiptNo || '—'}</td>
                        <td style="font-weight:600;color:var(--success);">${formatCurrency(f.amount)}</td>
                        <td style="font-size:12px;">${f.paymentMethod || 'cash'}</td>
                    </tr>
                `).join('');
            }
        }
    } catch(e) { console.error("Error loading fees:", e); }
}

function reviewStudentDetails(id) {
    const s = allStudentsList.find(x => x.id === id);
    if (!s) return;
    currentSelectedStudentId = id;
    const smTitle = document.getElementById('sm-title');
    if(smTitle) smTitle.textContent = '📋 Review / Edit: ' + s.name;
    
    document.getElementById('edit-student-id').value = id;
    document.getElementById('st-name').value = s.name || '';
    document.getElementById('st-mobile').value = s.mobile || '';
    document.getElementById('st-email').value = s.email || '';
    document.getElementById('st-aadhar').value = s.aadhar || '';
    
    // Address Fields
    document.getElementById('st-house').value = s.houseName || '';
    document.getElementById('st-place').value = s.place || '';
    document.getElementById('st-post').value = s.postOffice || '';
    document.getElementById('st-district').value = s.district || '';
    
    document.getElementById('st-qual').value = s.qualification || '';
    document.getElementById('st-spec').value = s.specialization || '';
    
    document.getElementById('st-course').value = s.courseId || '';
    document.getElementById('st-batch').value = s.batchId || '';
    document.getElementById('st-status').value = s.status || 'pending';
    openModal('student-modal');
}

async function quickStudentStatus(id, status) {
    await updateDoc('students', id, { status });
    showToast(`Student ${status}!`, status === 'accepted' ? 'success' : 'error');
}

async function quickStudentAction(status) {
    const id = document.getElementById('edit-student-id').value;
    if (!id) return;
    document.getElementById('st-status').value = status;
    await saveStudentData();
}

async function saveStudentData() {
    const id = document.getElementById('edit-student-id').value;
    if (!id) return;
    const courseId = document.getElementById('st-course').value;
    const batchId = document.getElementById('st-batch').value;
    const data = {
        name: document.getElementById('st-name').value.trim(),
        mobile: document.getElementById('st-mobile').value.trim(),
        email: document.getElementById('st-email').value.trim(),
        aadhar: document.getElementById('st-aadhar').value.trim(),
        
        houseName: document.getElementById('st-house').value.trim(),
        place: document.getElementById('st-place').value.trim(),
        postOffice: document.getElementById('st-post').value.trim(),
        district: document.getElementById('st-district').value.trim(),
        
        qualification: document.getElementById('st-qual').value,
        specialization: document.getElementById('st-spec').value.trim(),
        
        courseId, courseName: getCourseNameById(courseId),
        batchId, batchCode: getBatchCodeById(batchId),
        status: document.getElementById('st-status').value,
    };
    const btn = document.getElementById('save-st-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        await updateDoc('students', id, data);
        showToast('Student updated!', 'success');
        closeModal('student-modal');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = '💾 Save';
}

function openAddStudentModal() {
    ['na-name', 'na-mobile', 'na-addr', 'na-email', 'na-qual', 'na-dob', 'na-aadhar', 'na-house', 'na-place', 'na-post', 'na-district', 'na-spec'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const fields = ['na-course', 'na-batch', 'na-gender'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    openModal('add-student-modal');
}

async function addStudentManuallyEntry() {
    const name = document.getElementById('na-name').value.trim();
    const mobile = document.getElementById('na-mobile').value.trim();
    const courseId = document.getElementById('na-course').value;
    if (!name || !mobile || !courseId) { showToast('Fill required fields.', 'error'); return; }
    const btn = document.getElementById('na-btn');
    btn.disabled = true; btn.textContent = 'Adding...';
    const batchId = document.getElementById('na-batch').value;
    const data = {
        name, mobile, centreId, courseId,
        courseName: getCourseNameById(courseId),
        batchId, batchCode: getBatchCodeById(batchId),
        email: document.getElementById('na-email').value.trim(),
        aadhar: document.getElementById('na-aadhar').value.trim(),
        houseName: document.getElementById('na-house').value.trim(),
        place: document.getElementById('na-place').value.trim(),
        postOffice: document.getElementById('na-post').value.trim(),
        district: document.getElementById('na-district').value.trim(),
        qualification: document.getElementById('na-qual').value,
        specialization: document.getElementById('na-spec').value.trim(),
        status: 'accepted', source: 'centre'
    };
    try {
        await addDoc('students', data);
        showToast('Student added!', 'success');
        closeModal('add-student-modal');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Add Student';
}

async function deleteStudentRecord(id) {
    if (!confirm('Delete this student record?')) return;
    await deleteDoc('students', id); showToast('Deleted.', 'success');
}

function exportStudentsDataCSV() {
    const data = allStudentsList.map(s => ({ 'Name': s.name, 'Mobile': s.mobile, 'Email': s.email, 'Address': s.address, 'Qualification': s.qualification, 'Course': s.courseName || getCourseNameById(s.courseId), 'Batch': getBatchCodeById(s.batchId), 'Status': s.status, 'Gender': s.gender, 'DOB': s.dob, 'Aadhar': s.aadhar }));
    exportToExcel(data, 'DSDC_Students');
}

// --- Page: batches.html ---
let viewBatchStudentsData = null;

async function loadBatchesPage() {
    const ctx = await initPage('Batches');
    if (!ctx) return;
    centreId = ctx.session.user.uid;

    const [cSnap, tSnap] = await Promise.all([
        db.collection('courses').where('centreId', '==', centreId).where('status', '==', 'active').get(),
        db.collection('trainers').where('centreId', '==', centreId).get()
    ]);
    allCoursesList = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTrainersList = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const cSel = document.getElementById('b-course');
    const fCourse = document.getElementById('f-course');
    allCoursesList.forEach(c => {
        if(cSel) cSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        if(fCourse) fCourse.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    const tSel = document.getElementById('b-trainer');
    if (tSel) allTrainersList.forEach(t => tSel.innerHTML += `<option value="${t.id}">${t.name}</option>`);

    db.collection('batches').where('centreId', '==', centreId).onSnapshot(snap => {
        allBatchesList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        renderBatchesList();
    });
}

function onBatchCourseSelect() {
    const id = document.getElementById('b-course').value;
    const c = allCoursesList.find(x => x.id === id);
    const cdText = document.getElementById('cd-text');
    const cdBox = document.getElementById('course-details-box');
    if (c) {
        if(cdText) cdText.textContent = `QP: ${c.qpCode || '—'} | Sector: ${c.sector || '—'} | Days: ${c.totalDays || '—'} | Min Students: ${c.minStudents || '—'}`;
        if(cdBox) cdBox.style.display = 'block';
    } else if(cdBox) cdBox.style.display = 'none';
}

function renderBatchesList() {
    const srchBatch = document.getElementById('srch-batch');
    const fCourse = document.getElementById('f-course');
    const fStatus = document.getElementById('f-status');
    if(!srchBatch || !fCourse || !fStatus) return;

    const s = srchBatch.value.toLowerCase();
    const fc = fCourse.value;
    const fs = fStatus.value;
    let data = allBatchesList.filter(b =>
        (!s || (b.batchCode || '').toLowerCase().includes(s) || (b.courseName || '').toLowerCase().includes(s)) &&
        (!fc || b.courseId === fc) &&
        (!fs || b.status === fs)
    );
    const tbody = document.getElementById('batches-tbody');
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No batches found</td></tr>'; return; }
    tbody.innerHTML = data.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${b.batchCode || '—'}</strong></td>
      <td>${b.courseName || '—'}</td>
      <td>${b.trainerName || '—'}</td>
      <td>${formatDate(b.startDate)}</td>
      <td>${formatDate(b.endDate)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewBatchStudents('${b.id}')">👁️ View</button></td>
      <td><span class="badge badge-${b.status === 'ongoing' ? 'success' : b.status === 'completed' ? 'grey' : 'info'}">${b.status || 'upcoming'}</span></td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="editBatchRecord('${b.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBatchRecord('${b.id}')">🗑️</button>
      </td>
    </tr>`).join('');
}

function clearBatchFilters() {
    document.getElementById('srch-batch').value = '';
    document.getElementById('f-course').value = '';
    document.getElementById('f-status').value = '';
    renderBatchesList();
}

function openNewBatchModal() {
    ['edit-batch-id', 'b-code', 'b-start', 'b-end'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    document.getElementById('b-course').value = '';
    document.getElementById('b-trainer').value = '';
    document.getElementById('b-status').value = 'upcoming';
    const bmTitle = document.getElementById('batch-modal-title');
    if(bmTitle) bmTitle.textContent = '👥 New Batch';
    openModal('add-batch-modal');
}

function editBatchRecord(id) {
    const b = allBatchesList.find(x => x.id === id);
    if (!b) return;
    const bmTitle = document.getElementById('batch-modal-title');
    if(bmTitle) bmTitle.textContent = '✏️ Edit Batch';
    document.getElementById('edit-batch-id').value = id;
    document.getElementById('b-code').value = b.batchCode || '';
    document.getElementById('b-course').value = b.courseId || ''; 
    onBatchCourseSelect();
    document.getElementById('b-trainer').value = b.trainerId || '';
    document.getElementById('b-status').value = b.status || 'upcoming';
    document.getElementById('b-start').value = formatDateInput(b.startDate);
    document.getElementById('b-end').value = formatDateInput(b.endDate);
    document.getElementById('b-notes').value = b.notes || '';
    openModal('add-batch-modal');
}

async function saveBatchData() {
    const code = document.getElementById('b-code').value.trim();
    const courseId = document.getElementById('b-course').value;
    const trainerId = document.getElementById('b-trainer').value;
    const status = document.getElementById('b-status').value;
    const start = document.getElementById('b-start').value;
    const end = document.getElementById('b-end').value;
    
    // Dates are only mandatory if NOT upcoming
    if (!code || !courseId || !trainerId || (status !== 'upcoming' && (!start || !end))) { 
        showToast('Fill all required fields.', 'error'); 
        return; 
    }
    
    // Trainers aren't in allCoursesList, need to find from current session data if needed
    // Assuming trainers are loaded in allTrainersList (passed via loadBatchesPage)
    // For simplicity, using a generic way or re-fetching trainer if needed
    const course = allCoursesList.find(c => c.id === courseId);
    
    const notes = document.getElementById('b-notes').value.trim();
    
    const btn = document.getElementById('save-batch-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    const data = {
        batchCode: code, courseId, courseName: course?.name || '', 
        trainerId, trainerName: document.getElementById('b-trainer').options[document.getElementById('b-trainer').selectedIndex]?.text || '—',
        startDate: start ? new Date(start) : null, 
        endDate: end ? new Date(end) : null,
        status: status,
        notes,
        centreId
    };
    try {
        const editId = document.getElementById('edit-batch-id').value;
        if (editId) { await updateDoc('batches', editId, data); showToast('Batch updated!', 'success'); }
        else { await addDoc('batches', data); showToast('Batch created!', 'success'); }
        closeModal('add-batch-modal');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Save Batch';
}

async function deleteBatchRecord(id) {
    if (!confirm('Delete this batch?')) return;
    await deleteDoc('batches', id); showToast('Batch deleted.', 'success');
}

async function viewBatchStudents(batchId) {
    const b = allBatchesList.find(x => x.id === batchId);
    viewBatchStudentsData = b;
    const vbTitle = document.getElementById('view-batch-title');
    if(vbTitle) vbTitle.textContent = `Students in: ${b?.batchCode || 'Batch'}`;
    const snap = await db.collection('students').where('batchId', '==', batchId).get();
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tbody = document.getElementById('view-students-tbody');
    if (!tbody) return;
    if (!students.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No students in this batch</td></tr>'; }
    else tbody.innerHTML = students.map((s, i) => `
    <tr>
      <td>${i + 1}</td><td><strong>${s.name}</strong></td><td>${s.mobile || '—'}</td>
      <td>${s.email || '—'}</td><td>${s.qualification || '—'}</td>
      <td><span class="badge badge-${s.status === 'accepted' ? 'success' : s.status === 'rejected' ? 'danger' : 'warning'}">${s.status || 'pending'}</span></td>
    </tr>`).join('');
    openModal('students-modal');
}

function exportBatchesDataCSV() {
    const data = allBatchesList.map(b => ({ 'Batch Code': b.batchCode, 'Course': b.courseName, 'Trainer': b.trainerName, 'Start': formatDate(b.startDate), 'End': formatDate(b.endDate), 'Status': b.status }));
    exportToExcel(data, 'DSDC_Batches');
}

function exportBatchStudentsList() {
    if (!viewBatchStudentsData) return;
    db.collection('students').where('batchId', '==', viewBatchStudentsData.id).get().then(snap => {
        const data = snap.docs.map(d => d.data()).map(s => ({ 'Name': s.name, 'Mobile': s.mobile, 'Email': s.email, 'Qualification': s.qualification, 'Status': s.status }));
        exportToExcel(data, `Batch_${viewBatchStudentsData.batchCode}_Students`);
    });
}

// --- Page: courses.html ---
async function loadCoursesPage() {
    const ctx = await initPage('Courses');
    if (!ctx) return;
    centreId = ctx.session.user.uid;

    db.collection('courses').where('centreId', '==', centreId).onSnapshot(snap => {
        allCoursesList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        renderCoursesList();
        buildCourseSectorFilter();
    });
}

function buildCourseSectorFilter() {
    const sectors = [...new Set(allCoursesList.map(c => c.sector).filter(Boolean))];
    const sel = document.getElementById('filter-sector');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Sectors</option>' + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
    sel.value = cur;
}

function renderCoursesList() {
    const searchCourse = document.getElementById('search-course');
    const filterSector = document.getElementById('filter-sector');
    if(!searchCourse || !filterSector) return;

    const search = searchCourse.value.toLowerCase();
    const sector = filterSector.value;
    let filtered = allCoursesList.filter(c =>
        (!search || (c.name || '').toLowerCase().includes(search) || (c.qpCode || '').toLowerCase().includes(search)) &&
        (!sector || c.sector === sector)
    );

    const tbody = document.getElementById('courses-tbody');
    if (!tbody) return;
    if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No courses found</td></tr>'; return; }
    tbody.innerHTML = filtered.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${c.name}</strong>${c.description ? `<br/><small style="color:var(--text-muted)">${c.description}</small>` : ''}</td>
      <td><span class="badge badge-info">${c.qpCode || '—'}</span></td>
      <td>${c.sector || '—'}</td>
      <td>${c.tpName || '—'}</td>
      <td>${c.minStudents || '—'}</td>
      <td>${c.totalDays || '—'} days</td>
      <td><span class="badge badge-${c.status === 'active' ? 'success' : 'grey'}">${c.status || 'active'}</span></td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="editCourseRecord('${c.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCourseRecord('${c.id}')">🗑️</button>
      </td>
    </tr>`).join('');
}

function clearCourseFilters() {
    document.getElementById('search-course').value = '';
    document.getElementById('filter-sector').value = '';
    renderCoursesList();
}

function editCourseRecord(id) {
    const c = allCoursesList.find(x => x.id === id);
    if (!c) return;
    const mTitle = document.getElementById('modal-title');
    if(mTitle) mTitle.textContent = '✏️ Edit Course';
    document.getElementById('edit-course-id').value = id;
    document.getElementById('c-name').value = c.name || '';
    document.getElementById('c-qpcode').value = c.qpCode || '';
    document.getElementById('c-sector').value = c.sector || '';
    document.getElementById('c-tpname').value = c.tpName || '';
    document.getElementById('c-minstudents').value = c.minStudents || '';
    document.getElementById('c-totaldays').value = c.totalDays || '';
    document.getElementById('c-fee').value = c.fee || '';
    document.getElementById('c-status').value = c.status || 'active';
    document.getElementById('c-description').value = c.description || '';
    openModal('add-course-modal');
}

function resetCourseForm() {
    ['edit-course-id', 'c-name', 'c-qpcode', 'c-sector', 'c-tpname', 'c-minstudents', 'c-totaldays', 'c-fee', 'c-description'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const cStatus = document.getElementById('c-status');
    if(cStatus) cStatus.value = 'active';
    const mTitle = document.getElementById('modal-title');
    if(mTitle) mTitle.textContent = '📚 Add New Course';
}

async function saveCourseData() {
    const name = document.getElementById('c-name').value.trim();
    const qpCode = document.getElementById('c-qpcode').value.trim();
    const sector = document.getElementById('c-sector').value.trim();
    const minStudents = document.getElementById('c-minstudents').value;
    const totalDays = document.getElementById('c-totaldays').value;
    
    // QP Code is now optional
    if (!name || !sector || !minStudents || !totalDays) { 
        showToast('Please fill all required fields.', 'error'); 
        return; 
    }

    const btn = document.getElementById('save-course-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    const editId = document.getElementById('edit-course-id').value;
    const descEl = document.getElementById('c-description');
    const data = {
        name, qpCode, sector, centreId,
        tpName: document.getElementById('c-tpname').value.trim(),
        minStudents: Number(minStudents), totalDays: Number(totalDays),
        fee: Number(document.getElementById('c-fee').value) || 0,
        status: document.getElementById('c-status').value,
        description: descEl ? descEl.value.trim() : ''
    };

    try {
        if (editId) { await updateDoc('courses', editId, data); showToast('Course updated!', 'success'); }
        else { await addDoc('courses', data); showToast('Course added!', 'success'); }
        closeModal('add-course-modal'); resetCourseForm();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Save Course';
}

async function deleteCourseRecord(id) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    await deleteDoc('courses', id);
    showToast('Course deleted.', 'success');
}

function openAddCourseModal() {
    resetCourseForm();
    openModal('add-course-modal');
}

function openAddBatchModal() {
    openNewBatchModal();
}

function exportCoursesDataCSV() {
    const data = allCoursesList.map(c => ({
        'Course Name': c.name, 'QP Code': c.qpCode, 'Sector': c.sector,
        'TP Name': c.tpName, 'Min Students': c.minStudents, 'Total Days': c.totalDays,
        'Fee': c.fee, 'Status': c.status
    }));
    exportToExcel(data, 'DSDC_Courses');
}

// --- Page: fees.html ---
let selectedStudentFee = null;
let lastFeeReceiptId = '';

async function loadFeesPage() {
    const ctx = await initPage('Fees Collection');
    if (!ctx) return;
    centreId = ctx.session.user.uid;
    centreData = ctx.centreData;
    const rpCentre = document.getElementById('rp-centre');
    if(rpCentre) rpCentre.textContent = centreData.centreName;

    const [bs, ss] = await Promise.all([
        db.collection('batches').where('centreId', '==', centreId).get(),
        db.collection('students').where('centreId', '==', centreId).where('status', '==', 'accepted').get()
    ]);
    allBatchesList = bs.docs.map(d => ({ id: d.id, ...d.data() }));
    allStudentsList = ss.docs.map(d => ({ id: d.id, ...d.data() }));

    const fBatch = document.getElementById('f-batch');
    if(fBatch) allBatchesList.forEach(b => fBatch.innerHTML += `<option value="${b.id}">${b.batchCode} — ${b.courseName}</option>`);

    populateFeeStudentSelect('');

    // Set default date to today
    const fDate = document.getElementById('f-date');
    const fTxn = document.getElementById('f-txn');
    if(fDate) fDate.value = new Date().toISOString().split('T')[0];
    if(fTxn) fTxn.value = generateId('REC-');

    // Listen for fees
    db.collection('fees').where('centreId', '==', centreId).onSnapshot(snap => {
        allFeesList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    });
}

function populateFeeStudentSelect(batchId) {
    const sel = document.getElementById('f-student');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Select Student --</option>';
    const students = batchId ? allStudentsList.filter(s => s.batchId === batchId) : allStudentsList;
    students.forEach(s => {
        const course = s.courseName || '';
        sel.innerHTML += `<option value="${s.id}">${s.name} — ${course}</option>`;
    });
}

function onFeeBatchChange() {
    const batchId = document.getElementById('f-batch').value;
    populateFeeStudentSelect(batchId);
    selectedStudentFee = null;
    const sib = document.getElementById('student-info-box');
    const ppc = document.getElementById('prev-payments-card');
    if(sib) sib.style.display = 'none';
    if(ppc) ppc.style.display = 'none';
}

async function onFeeStudentSelect() {
    const sid = document.getElementById('f-student').value;
    const sib = document.getElementById('student-info-box');
    if (!sid) { selectedStudentFee = null; if(sib) sib.style.display = 'none'; return; }
    selectedStudentFee = allStudentsList.find(s => s.id === sid);
    if (!selectedStudentFee) return;
    if(sib) {
        sib.style.display = 'block';
        sib.innerHTML = `<strong>${selectedStudentFee.name}</strong> | ${selectedStudentFee.mobile || ''} | ${selectedStudentFee.courseName || ''} | ${selectedStudentFee.batchCode || ''}`;
    }
    const rpStudent = document.getElementById('rp-student');
    const rpCourse = document.getElementById('rp-course');
    const rpBatch = document.getElementById('rp-batch');
    if(rpStudent) rpStudent.textContent = selectedStudentFee.name;
    if(rpCourse) rpCourse.textContent = selectedStudentFee.courseName || '—';
    if(rpBatch) rpBatch.textContent = selectedStudentFee.batchCode || '—';

    // Load previous payments
    const prevPay = allFeesList.filter(f => f.studentId === sid);
    const total = prevPay.reduce((a, f) => a + Number(f.amount), 0);
    const ppc = document.getElementById('prev-payments-card');
    if (prevPay.length) {
        if(ppc) ppc.style.display = 'block';
        const tpl = document.getElementById('total-paid-label');
        if(tpl) tpl.textContent = formatCurrency(total);
        const courseFee = allBatchesList.find(b => b.id === selectedStudentFee?.batchId)?.courseFee;
        const bl = document.getElementById('balance-label');
        if(bl) bl.textContent = courseFee ? formatCurrency(Number(courseFee) - total) : 'N/A';
        const pptbody = document.getElementById('prev-payments-tbody');
        if(pptbody) pptbody.innerHTML = prevPay.map(f => `
      <tr>
        <td><span class="badge badge-primary">${f.receiptNo || '—'}</span></td>
        <td>${formatDate(f.paymentDate || f.createdAt)}</td>
        <td><strong>${formatCurrency(f.amount)}</strong></td>
        <td>${f.paymentMode || 'Cash'}</td>
        <td>${f.remarks || '—'}</td>
      </tr>`).join('');
    } else if(ppc) {
        ppc.style.display = 'none';
    }
    updateFeeReceiptPreview();
}

function updateFeeReceiptPreview() {
    const amt = document.getElementById('f-amount');
    const mode = document.getElementById('f-mode');
    const date = document.getElementById('f-date');
    const txn = document.getElementById('f-txn');
    const remarks = document.getElementById('f-remarks');
    
    const rpAmount = document.getElementById('rp-amount');
    const rpMode = document.getElementById('rp-mode');
    const rpDate = document.getElementById('rp-date');
    const rpTxn = document.getElementById('rp-txn');
    const rpNo = document.getElementById('rp-no');
    const rpRemarks = document.getElementById('rp-remarks');

    if(rpAmount) rpAmount.textContent = formatCurrency(amt?.value || 0);
    if(rpMode) rpMode.textContent = mode?.value || 'Cash';
    if(rpDate) rpDate.textContent = date?.value || '—';
    if(rpTxn) rpTxn.textContent = txn?.value || '—';
    if(rpNo) rpNo.textContent = txn?.value || '—';
    if(rpRemarks) rpRemarks.textContent = remarks?.value || '—';
}

async function collectStudentFee() {
    if (!selectedStudentFee) { showToast('Please select a student.', 'error'); return; }
    const amt = document.getElementById('f-amount').value;
    const date = document.getElementById('f-date').value;
    if (!amt || Number(amt) <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    if (!date) { showToast('Select payment date.', 'error'); return; }
    const btn = document.getElementById('collect-btn');
    btn.disabled = true; btn.textContent = 'Processing...';

    const receiptNo = document.getElementById('f-txn').value || generateId('REC-');
    const data = {
        studentId: selectedStudentFee.id, studentName: selectedStudentFee.name,
        courseId: selectedStudentFee.courseId, courseName: selectedStudentFee.courseName || '',
        batchId: selectedStudentFee.batchId, batchCode: selectedStudentFee.batchCode || '',
        amount: Number(amt), paymentMode: document.getElementById('f-mode').value,
        paymentDate: new Date(date), receiptNo,
        remarks: document.getElementById('f-remarks').value.trim(),
        centreName: centreData.centreName, centreId
    };

    try {
        await addDoc('fees', data);
        lastFeeReceiptId = receiptNo;
        showToast('Fee collected! Receipt ready.', 'success');
        const pb = document.getElementById('print-btn');
        if(pb) pb.disabled = false;
        buildPrintReceiptHTML(data, receiptNo);
        openModal('print-modal');
        // Reset
        document.getElementById('f-amount').value = '';
        document.getElementById('f-txn').value = generateId('REC-');
        document.getElementById('f-remarks').value = '';
        await onFeeStudentSelect();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = '💳 Collect & Generate Receipt';
}

function buildPrintReceiptHTML(data, receiptNo) {
    const pmb = document.getElementById('print-modal-body');
    if(!pmb) return;
    
    // Official DSDC logo
    const logoImg = `<img src="https://res.cloudinary.com/dohsh2sal/image/upload/v1773303953/copy_of_district_skill_o5cnkk_47abf0.png" style="width:48px;height:48px;object-fit:contain;" alt="DSDC Logo">`;

    pmb.innerHTML = `
    <div class="receipt" style="width:100%; border:none; padding:10px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid var(--primary); padding-bottom: 16px; margin-bottom: 24px;">
        <div style="display:flex; align-items:center; gap: 16px;">
          ${logoImg}
          <div>
            <h2 style="font-size:26px;font-weight:900;color:var(--primary);margin:0;line-height:1;letter-spacing:-0.5px;">DSDC</h2>
            <p style="font-size:12px;color:var(--text);font-weight:700;margin:0;margin-top:4px;">District Skill Development Centre</p>
          </div>
        </div>
        <div style="text-align:right;">
          <h1 style="margin:0;color:var(--text);font-size:20px;letter-spacing:1px;text-transform:uppercase;">FEE RECEIPT</h1>
          <p style="margin:0;font-size:12px;color:var(--text-muted);margin-top:4px;">${centreData?.centreName || 'Authorized Centre'}</p>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; margin-bottom: 24px; font-size:13px; background:#f8fafc; padding:12px 16px; border-radius:8px; border:1px solid var(--border);">
        <div><div style="color:var(--text-muted);font-size:11px;margin-bottom:2px;">Receipt No</div><strong style="font-size:14px;color:var(--text);">${receiptNo}</strong></div>
        <div style="text-align:right;"><div style="color:var(--text-muted);font-size:11px;margin-bottom:2px;">Date</div><strong style="font-size:14px;">${data.paymentDate instanceof Date ? data.paymentDate.toLocaleDateString('en-IN') : formatDate(data.paymentDate)}</strong></div>
      </div>
      
      <div style="margin-bottom:32px;">
        <div class="r-row"><span class="r-label">Received from</span><span class="r-value" style="font-size:16px;">${data.studentName}</span></div>
        <div class="r-row"><span class="r-label">Course</span><span class="r-value">${data.courseName || '—'}</span></div>
        <div class="r-row"><span class="r-label">Batch Code</span><span class="r-value">${data.batchCode || '—'}</span></div>
        <div class="r-row"><span class="r-label">Payment Mode</span><span class="r-value">${data.paymentMode}</span></div>
        ${data.remarks ? `<div class="r-row"><span class="r-label">Remarks</span><span class="r-value">${data.remarks}</span></div>` : ''}
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div style="font-size:11px;color:var(--text-muted);">
          <p style="margin:0;margin-bottom:4px;">* This is a computer generated receipt</p>
          <p style="margin:0;">* Needs authorized stamp if printed</p>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px; font-weight:800; color:var(--primary); background:#eef2ff; padding:8px 32px; border-radius:8px; border:2px dashed #818cf8; margin-bottom:24px;">
            ${formatCurrency(data.amount)}
          </div>
          <p style="margin:0;font-size:13px;font-weight:600;border-top:1px solid var(--border);padding-top:8px;width:180px;">Authorized Signatory</p>
        </div>
      </div>
    </div>`;
}

function switchFeeSection(sec, btn) {
    const cs = document.getElementById('collect-section');
    const hs = document.getElementById('history-section');
    if(cs) cs.style.display = sec === 'collect' ? 'block' : 'none';
    if(hs) hs.style.display = sec === 'history' ? 'block' : 'none';
    const feesView = document.getElementById('view-fees');
    if(feesView) feesView.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (sec === 'history') renderFeeHistoryTable();
}

function renderFeeHistoryTable() {
    const fhs = document.getElementById('fh-search');
    const fhm = document.getElementById('fh-mode');
    const fhf = document.getElementById('fh-from');
    const fht = document.getElementById('fh-to');
    if(!fhs) return;

    const search = fhs.value.toLowerCase();
    const mode = fhm.value;
    const from = fhf.value;
    const to = fht.value;
    let data = allFeesList.filter(f =>
        (!search || (f.studentName || '').toLowerCase().includes(search)) &&
        (!mode || f.paymentMode === mode) &&
        (!from || new Date(f.paymentDate?.toDate?.() || f.paymentDate) >= new Date(from)) &&
        (!to || new Date(f.paymentDate?.toDate?.() || f.paymentDate) <= new Date(to + 'T23:59'))
    );
    const total = data.reduce((a, f) => a + Number(f.amount), 0);
    const htl = document.getElementById('hist-total-label');
    if(htl) htl.textContent = formatCurrency(total);
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No records found</td></tr>'; return; }
    tbody.innerHTML = data.map((f, i) => `<tr>
    <td><span class="badge badge-primary">${f.receiptNo || '—'}</span></td>
    <td><strong>${f.studentName || '—'}</strong></td>
    <td>${f.courseName || '—'}</td>
    <td><strong>${formatCurrency(f.amount)}</strong></td>
    <td>${f.paymentMode || '—'}</td>
    <td>${formatDate(f.paymentDate || f.createdAt)}</td>
    <td>${f.remarks || '—'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="viewFeeReceiptHistory('${f.id}')">🧾 Receipt</button></td>
  </tr>`).join('');
}

function viewFeeReceiptHistory(id) {
    const f = allFeesList.find(x => x.id === id);
    if (!f) return;
    buildPrintReceiptHTML(f, f.receiptNo || f.id.slice(0, 8).toUpperCase());
    openModal('print-modal');
}

function printFeeReceipt() { openModal('print-modal'); }

function clearFeeHistoryFilters() {
    ['fh-search', 'fh-from', 'fh-to'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const fhm = document.getElementById('fh-mode');
    if(fhm) fhm.value = '';
    renderFeeHistoryTable();
}

function exportFeesCollectionCSV() {
    const data = allFeesList.map(f => ({ 'Receipt No.': f.receiptNo, 'Student': f.studentName, 'Course': f.courseName, 'Batch': f.batchCode, 'Amount(₹)': f.amount, 'Mode': f.paymentMode, 'Date': formatDate(f.paymentDate || f.createdAt), 'Remarks': f.remarks }));
    exportToExcel(data, 'DSDC_Fees_Collection');
}

// --- Page: attendance.html ---
let batchAttendanceStudents = [];
let attendanceDateCols = [];
let currentBatchAttendance = null;
let currentAttendanceData = {};

async function loadAttendancePage() {
    const ctx = await initPage('Attendance');
    if (!ctx) return;
    centreId = ctx.session.user.uid;

    const snap = await db.collection('batches').where('centreId', '==', centreId).get();
    allBatchesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('att-batch');
    if(sel) {
        sel.innerHTML = '<option value="">-- Select Batch --</option>';
        allBatchesList.forEach(b => sel.innerHTML += `<option value="${b.id}">${b.batchCode} — ${b.courseName}</option>`);
    }
}

function onAttendanceBatchSelect() {
    const id = document.getElementById('att-batch').value;
    const b = allBatchesList.find(x => x.id === id);
    if (!b) return;
    currentBatchAttendance = b;
    const info = document.getElementById('batch-info-box');
    if(info) {
        info.style.display = 'block';
        info.innerHTML = `<strong>${b.batchCode}</strong> | Course: ${b.courseName} | Trainer: ${b.trainerName || '—'} | Start: ${formatDate(b.startDate)} → ${formatDate(b.endDate)}`;
    }
    const af = document.getElementById('att-from');
    const at = document.getElementById('att-to');
    if (af && b.startDate) af.value = formatDateInput(b.startDate);
    if (at && b.endDate) at.value = formatDateInput(b.endDate);
}

function getDatesInAttendanceRange(from, to) {
    const dates = []; let d = new Date(from);
    const end = new Date(to);
    while (d <= end) {
        dates.push(new Date(d).toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

async function loadAttendanceSheet() {
    const batchId = document.getElementById('att-batch').value;
    const from = document.getElementById('att-from').value;
    const to = document.getElementById('att-to').value;
    if (!batchId || !from || !to) { showToast('Please select batch and date range.', 'error'); return; }
    if (new Date(from) > new Date(to)) { showToast('From date must be before To date.', 'error'); return; }

    showLoading();
    try {
        attendanceDateCols = getDatesInAttendanceRange(from, to);
        if (attendanceDateCols.length > 60) { showToast('Max 60 days per sheet.', 'warning'); hideLoading(); return; }

        const [stuSnap, attSnap] = await Promise.all([
            db.collection('students').where('batchId', '==', batchId).where('status', '==', 'accepted').get(),
            db.collection('attendance').where('batchId', '==', batchId).get()
        ]);

        batchAttendanceStudents = stuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        currentAttendanceData = {};
        attSnap.forEach(doc => { currentAttendanceData[doc.id] = doc.data(); }); 

        buildAttendanceTable();
        const asc = document.getElementById('att-sheet-card');
        const sab = document.getElementById('save-att-btn');
        const eab = document.getElementById('export-att-btn');
        const ast = document.getElementById('att-sheet-title');
        if(asc) asc.style.display = 'block';
        if(sab) sab.style.display = 'flex';
        if(eab) eab.style.display = 'flex';
        if(ast) ast.textContent = `${currentBatchAttendance?.batchCode} — ${from} to ${to} (${attendanceDateCols.length} days)`;
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    hideLoading();
}

function buildAttendanceTable() {
    const hr = document.getElementById('att-header-row');
    if(!hr) return;
    hr.innerHTML = '<th style="min-width:160px;background:var(--dark);color:#fff;">Student Name</th>' +
        attendanceDateCols.map(d => {
            const dt = new Date(d);
            const dd = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const day = dt.toLocaleDateString('en-IN', { weekday: 'short' });
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            return `<th style="text-align:center;min-width:56px;${isWeekend ? 'color:#fc8181;' : ''}">${dd}<br/><span style="font-size:9px;font-weight:400;">${day}</span></th>`;
        }).join('') +
        '<th style="text-align:center;min-width:70px;">Total P</th>';

    const tbody = document.getElementById('att-tbody');
    if (!tbody) return;
    if (!batchAttendanceStudents.length) { tbody.innerHTML = `<tr><td colspan="${attendanceDateCols.length + 2}" class="table-empty">No accepted students in this batch</td></tr>`; return; }

    tbody.innerHTML = batchAttendanceStudents.map(s => {
        const cells = attendanceDateCols.map(date => {
            const key = `${s.id}_${date}`;
            const present = currentAttendanceData[key]?.present || false;
            return `<td class="${present ? 'att-present' : 'att-absent'}" style="text-align:center;padding:6px;" id="cell_${s.id}_${date}">
        <span class="${present ? 'att-present-dot' : 'att-absent-dot'}" onclick="toggleAttendanceStatus('${s.id}','${date}',this)">
          ${present ? '✓' : '·'}
        </span></td>`;
        });
        return `<tr>
      <td style="position:sticky;left:0;background:#fff;box-shadow:2px 0 5px rgba(0,0,0,.05);">
        <span style="font-weight:600;">${s.name}</span>
      </td>
      ${cells.join('')}
      <td style="text-align:center;font-weight:700;color:var(--primary);" id="total_${s.id}">
        ${attendanceDateCols.filter(d => currentAttendanceData[`${s.id}_${d}`]?.present).length}
      </td>
    </tr>`;
    }).join('');
}

function toggleAttendanceStatus(studentId, date, el) {
    const key = `${studentId}_${date}`;
    const current = currentAttendanceData[key]?.present || false;
    const newVal = !current;
    if (!currentAttendanceData[key]) currentAttendanceData[key] = { studentId, date, batchId: document.getElementById('att-batch').value, centreId };
    currentAttendanceData[key].present = newVal;

    const cell = document.getElementById(`cell_${studentId}_${date}`);
    if (newVal) { cell.className = 'att-present'; el.className = 'att-present-dot'; el.textContent = '✓'; }
    else { cell.className = 'att-absent'; el.className = 'att-absent-dot'; el.textContent = '·'; }

    const total = attendanceDateCols.filter(d => currentAttendanceData[`${studentId}_${d}`]?.present).length;
    const totalEl = document.getElementById(`total_${studentId}`);
    if (totalEl) totalEl.textContent = total;
}

async function saveAttendanceBatchData() {
    const btn = document.getElementById('save-att-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const batch = db.batch();
        Object.entries(currentAttendanceData).forEach(([key, val]) => {
            const ref = db.collection('attendance').doc(key);
            batch.set(ref, { ...val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        await batch.commit();
        showToast('Attendance saved!', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = '💾 Save Attendance';
}

function exportAttendanceSheetCSV() {
    const batchCode = currentBatchAttendance?.batchCode || 'Batch';
    const rows = batchAttendanceStudents.map(s => {
        const row = { 'Student Name': s.name };
        let total = 0;
        attendanceDateCols.forEach(d => {
            const p = currentAttendanceData[`${s.id}_${d}`]?.present || false;
            row[d] = p ? 'P' : 'A';
            if (p) total++;
        });
        row['Total Present'] = total;
        row['Percentage'] = ((total / attendanceDateCols.length) * 100).toFixed(1) + '%';
        return row;
    });
    exportToExcel(rows, `Attendance_${batchCode}`);
}

// --- Page: reports.html ---
let currentCentreReportType = 'trainers';
let currentCentreReportRows = [];

async function loadCentreReportsPage() {
    const ctx = await initPage('Reports');
    if (!ctx) return;
    centreId = ctx.session.user.uid;

    showLoading();
    const [tr, co, ba, st, fe, at] = await Promise.all([
        db.collection('trainers').where('centreId', '==', centreId).get(),
        db.collection('courses').where('centreId', '==', centreId).get(),
        db.collection('batches').where('centreId', '==', centreId).get(),
        db.collection('students').where('centreId', '==', centreId).get(),
        db.collection('fees').where('centreId', '==', centreId).get(),
        db.collection('attendance').where('centreId', '==', centreId).get()
    ]);
    allData = {
        trainers: tr.docs.map(d => ({ id: d.id, ...d.data() })),
        courses: co.docs.map(d => ({ id: d.id, ...d.data() })),
        batches: ba.docs.map(d => ({ id: d.id, ...d.data() })),
        students: st.docs.map(d => ({ id: d.id, ...d.data() })),
        fees: fe.docs.map(d => ({ id: d.id, ...d.data() })),
        attendance: at.docs.map(d => ({ id: d.id, ...d.data() }))
    };

    const rfBatch = document.getElementById('rf-batch');
    const rfCourse = document.getElementById('rf-course');
    if(rfBatch) {
        rfBatch.innerHTML = '<option value="">All Batches</option>';
        allData.batches.forEach(b => rfBatch.innerHTML += `<option value="${b.id}">${b.batchCode} — ${b.courseName}</option>`);
    }
    if(rfCourse) {
        rfCourse.innerHTML = '<option value="">All Courses</option>';
        allData.courses.forEach(c => rfCourse.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    }

    hideLoading();
    runCentreReport();
}

function selectCentreReportType(type, el) {
    currentCentreReportType = type;
    document.querySelectorAll('.report-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const showBatch = ['batch-students', 'attendance'].includes(type);
    const showCourse = ['batches', 'batch-students', 'all-students'].includes(type);
    const showStatus = ['all-students'].includes(type);
    const showFees = ['all-students'].includes(type);
    const showDates = ['fees', 'all-students', 'batches'].includes(type);
    
    const fbw = document.getElementById('f-batch-wrap');
    const fcw = document.getElementById('f-course-wrap');
    const fsw = document.getElementById('f-status-wrap');
    const ffw = document.getElementById('f-fees-wrap');
    const ffrw = document.getElementById('f-from-wrap');
    const ftw = document.getElementById('f-to-wrap');
    const eb = document.getElementById('export-btn');

    if(fbw) fbw.style.display = showBatch ? 'block' : 'none';
    if(fcw) fcw.style.display = showCourse ? 'block' : 'none';
    if(fsw) fsw.style.display = showStatus ? 'block' : 'none';
    if(ffw) ffw.style.display = showFees ? 'block' : 'none';
    if(ffrw) ffrw.style.display = showDates ? 'block' : 'none';
    if(ftw) ftw.style.display = showDates ? 'block' : 'none';
    if(eb) eb.style.display = 'flex';
    
    runCentreReport();
}

function clearCentreReportFilters() {
    ['rf-batch', 'rf-course', 'rf-status', 'rf-fees', 'rf-from', 'rf-to', 'rf-search'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    runCentreReport();
}

function runCentreReport() {
    const searchEl = document.getElementById('rf-search');
    if(!searchEl) return;
    
    const search = searchEl.value.toLowerCase();
    const batchId = document.getElementById('rf-batch').value;
    const courseId = document.getElementById('rf-course').value;
    const status = document.getElementById('rf-status').value;
    const feesFilter = document.getElementById('rf-fees').value;
    const from = document.getElementById('rf-from').value;
    const to = document.getElementById('rf-to').value;

    let headers = [], rows = [], extraInfo = '';

    if (currentCentreReportType === 'trainers') {
        headers = ['#', 'Name', 'Mobile', 'Email', 'Specialization', 'Qualification', 'Experience', 'Status'];
        const data = allData.trainers.filter(t => !search || (t.name || '').toLowerCase().includes(search));
        currentCentreReportRows = data.map(t => ({ 'Name': t.name, 'Mobile': t.mobile, 'Email': t.email, 'Specialization': t.specialization, 'Qualification': t.qualification, 'Experience': t.experience, 'Status': t.status }));
        rows = data.map((t, i) => [i + 1, t.name, t.mobile, t.email || '—', t.specialization, t.qualification || '—', (t.experience || 0) + ' yrs', centreBadge(t.status === 'active' ? 'success' : 'grey', t.status)]);

    } else if (currentCentreReportType === 'courses') {
        headers = ['#', 'Course Name', 'QP Code', 'Sector', 'TP Name', 'Min Students', 'Total Days', 'Status'];
        const data = allData.courses.filter(c => !search || (c.name || '').toLowerCase().includes(search) || (c.qpCode || '').toLowerCase().includes(search));
        currentCentreReportRows = data.map(c => ({ 'Name': c.name, 'QP Code': c.qpCode, 'Sector': c.sector, 'TP Name': c.tpName, 'Min Students': c.minStudents, 'Total Days': c.totalDays, 'Status': c.status }));
        rows = data.map((c, i) => [i + 1, `<strong>${c.name}</strong>`, centreBadge('info', c.qpCode || '—'), c.sector || '—', c.tpName || '—', c.minStudents || '—', c.totalDays || '—', centreBadge(c.status === 'active' ? 'success' : 'grey', c.status)]);

    } else if (currentCentreReportType === 'batches') {
        headers = ['#', 'Batch Code', 'Course', 'Trainer', 'Start Date', 'End Date', 'Status'];
        let data = allData.batches;
        if (courseId) data = data.filter(b => b.courseId === courseId);
        if (from) data = data.filter(b => new Date(b.startDate?.toDate?.() || b.startDate) >= new Date(from));
        if (to) data = data.filter(b => new Date(b.startDate?.toDate?.() || b.startDate) <= new Date(to));
        if (search) data = data.filter(b => (b.batchCode || '').toLowerCase().includes(search) || (b.courseName || '').toLowerCase().includes(search));
        currentCentreReportRows = data.map(b => ({ 'Batch Code': b.batchCode, 'Course': b.courseName, 'Trainer': b.trainerName, 'Start': formatDate(b.startDate), 'End': formatDate(b.endDate), 'Status': b.status }));
        rows = data.map((b, i) => [i + 1, `<strong>${b.batchCode}</strong>`, b.courseName || '—', b.trainerName || '—', formatDate(b.startDate), formatDate(b.endDate), centreBadge(b.status === 'ongoing' ? 'success' : b.status === 'completed' ? 'grey' : 'info', b.status || 'upcoming')]);

    } else if (currentCentreReportType === 'batch-students') {
        headers = ['#', 'Batch Code', 'Course', 'Student Name', 'Mobile', 'Email', 'Qualification', 'Status'];
        let students = allData.students;
        if (batchId) students = students.filter(s => s.batchId === batchId);
        if (courseId) students = students.filter(s => s.courseId === courseId);
        if (search) students = students.filter(s => (s.name || '').toLowerCase().includes(search) || (s.mobile || '').includes(search));
        currentCentreReportRows = students.map(s => ({ 'Batch': s.batchCode, 'Course': s.courseName, 'Name': s.name, 'Mobile': s.mobile, 'Email': s.email, 'Qualification': s.qualification, 'Status': s.status }));
        rows = students.map((s, i) => [i + 1, s.batchCode || '—', s.courseName || '—', s.name, s.mobile || '—', s.email || '—', s.qualification || '—', centreBadge(s.status === 'accepted' ? 'success' : s.status === 'rejected' ? 'danger' : 'warning', s.status)]);

    } else if (currentCentreReportType === 'all-students') {
        headers = ['#', 'Name', 'Mobile', 'Email', 'Course', 'Batch', 'Qualification', 'Status', 'Fees Paid'];
        let students = allData.students;
        if (courseId) students = students.filter(s => s.courseId === courseId);
        if (status) students = students.filter(s => s.status === status);
        if (search) students = students.filter(s => (s.name || '').toLowerCase().includes(search) || (s.mobile || '').includes(search));
        if (feesFilter) {
            const paidIds = new Set(allData.fees.map(f => f.studentId));
            if (feesFilter === 'paid') students = students.filter(s => paidIds.has(s.id));
            if (feesFilter === 'unpaid') students = students.filter(s => !paidIds.has(s.id));
        }
        currentCentreReportRows = students.map(s => {
            const paid = allData.fees.filter(f => f.studentId === s.id).reduce((a, f) => a + Number(f.amount), 0);
            return { 'Name': s.name, 'Mobile': s.mobile, 'Email': s.email, 'Course': s.courseName, 'Batch': s.batchCode, 'Qualification': s.qualification, 'Status': s.status, 'Fees Paid(₹)': paid };
        });
        rows = students.map((s, i) => {
            const paid = allData.fees.filter(f => f.studentId === s.id).reduce((a, f) => a + Number(f.amount), 0);
            return [i + 1, `<strong>${s.name}</strong>`, s.mobile || '—', s.email || '—', s.courseName || '—', s.batchCode || '—', s.qualification || '—', centreBadge(s.status === 'accepted' ? 'success' : s.status === 'rejected' ? 'danger' : 'warning', s.status), `<strong>${formatCurrency(paid)}</strong>`];
        });

    } else if (currentCentreReportType === 'fees') {
        headers = ['#', 'Receipt No.', 'Student', 'Course', 'Batch', 'Amount', 'Mode', 'Date', 'Remarks'];
        let data = allData.fees;
        if (from) data = data.filter(f => new Date(f.paymentDate?.toDate?.() || f.paymentDate) >= new Date(from));
        if (to) data = data.filter(f => new Date(f.paymentDate?.toDate?.() || f.paymentDate) <= new Date(to + 'T23:59'));
        if (search) data = data.filter(f => (f.studentName || '').toLowerCase().includes(search));
        const total = data.reduce((a, f) => a + Number(f.amount), 0);
        extraInfo = `Total Collected: <strong>${formatCurrency(total)}</strong>`;
        currentCentreReportRows = data.map(f => ({ 'Receipt': f.receiptNo, 'Student': f.studentName, 'Course': f.courseName, 'Batch': f.batchCode, 'Amount': f.amount, 'Mode': f.paymentMode, 'Date': formatDate(f.paymentDate || f.createdAt), 'Remarks': f.remarks }));
        rows = data.map((f, i) => [i + 1, centreBadge('primary', f.receiptNo || '—'), f.studentName || '—', f.courseName || '—', f.batchCode || '—', `<strong>${formatCurrency(f.amount)}</strong>`, f.paymentMode || '—', formatDate(f.paymentDate || f.createdAt), f.remarks || '—']);

    } else if (currentCentreReportType === 'attendance') {
        headers = ['#', 'Student', 'Course', 'Batch', 'Present Days'];
        let students = allData.students.filter(s => s.status === 'accepted');
        if (batchId) students = students.filter(s => s.batchId === batchId);
        if (search) students = students.filter(s => (s.name || '').toLowerCase().includes(search));
        currentCentreReportRows = students.map(s => {
            const present = allData.attendance.filter(a => a.studentId === s.id && a.present).length;
            return { 'Name': s.name, 'Course': s.courseName, 'Batch': s.batchCode, 'Present Days': present };
        });
        rows = students.map((s, i) => {
            const present = allData.attendance.filter(a => a.studentId === s.id && a.present).length;
            return [i + 1, s.name, s.courseName || '—', s.batchCode || '—', `<span style="font-weight:700;color:var(--primary);">${present}</span>`];
        });
    }

    const sumBar = document.getElementById('report-summary');
    if(sumBar) {
        sumBar.style.display = 'flex';
        document.getElementById('rs-count').textContent = currentCentreReportRows.length;
        document.getElementById('rs-extra').innerHTML = extraInfo;
    }
    
    renderCentreReportsTable(headers, rows);
}

function centreBadge(type, text) { return `<span class="badge badge-${type}">${text}</span>`; }

function renderCentreReportsTable(headers, rows) {
    const thead = document.getElementById('report-thead');
    const tbody = document.getElementById('report-tbody');
    if(!thead || !tbody) return;
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="${headers.length}" class="table-empty">No data found</td></tr>`; return; }
    tbody.innerHTML = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
}

function exportCurrentCentreReportCSV() {
    if (!currentCentreReportRows.length) { showToast('No data to export.', 'warning'); return; }
    exportToExcel(currentCentreReportRows, `DSDC_Report_${currentCentreReportType}_${new Date().toISOString().split('T')[0]}`);
}

// --- Page: profile.html ---
function switchProfileTab(tab, btn) {
    const profileView = document.getElementById('view-profile');
    if (!profileView) return;
    profileView.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    profileView.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('tab-' + tab);
    if (target) target.classList.add('active');
}

async function loadProfilePage() {
    const ctx = await initPage('Profile');
    if (!ctx) return;
    centreId = ctx.session.user.uid;
    const c = ctx.centreData;

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

    if (c) {
        const avatarEl = document.getElementById('p-avatar');
        const titleEl  = document.getElementById('p-title');
        const subEl    = document.getElementById('p-subtitle');
        if(avatarEl) avatarEl.textContent = initials(c.centreName || 'C');
        if(titleEl)  titleEl.textContent  = c.centreName || '';
        if(subEl)    subEl.textContent    = `Email: ${ctx.session.user.email || ''}`;

        setVal('pc-name',  c.centreName);
        setVal('pc-code',  c.branchCode || c.id);
        setVal('pc-addr',  c.address);
        setVal('pc-email', ctx.session.user.email);
        setVal('pc-phone', c.phone);
        setVal('pc-cname', c.contactName);
        setVal('pc-desig', c.designation);
        setVal('pc-cmob',  c.contactMobile);
        setVal('pc-calt',  c.altContact);
    }
}

async function saveProfileData() {
    const btn = document.getElementById('save-p-btn');
    if(btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

    const data = {
        centreName:    getVal('pc-name'),
        address:       getVal('pc-addr'),
        phone:         getVal('pc-phone'),
        email:         getVal('pc-email'),
        contactName:   getVal('pc-cname'),
        designation:   getVal('pc-desig'),
        contactMobile: getVal('pc-cmob'),
        altContact:    getVal('pc-calt'),
    };

    try {
        await updateDoc('centres', centreId, data);
        const titleEl  = document.getElementById('p-title');
        const avatarEl = document.getElementById('p-avatar');
        if(titleEl)  titleEl.textContent  = data.centreName;
        if(avatarEl) avatarEl.textContent = initials(data.centreName);
        showToast('Profile updated successfully!', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }

    if(btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
}

async function sendResetPasswordLink() {
    const btn = document.getElementById('reset-p-btn');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
        await auth.sendPasswordResetEmail(document.getElementById('pc-email').value);
        showToast('Reset link sent to your email.', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    btn.textContent = '📧 Send Reset Link';
    setTimeout(() => btn.disabled = false, 10000);
}

// --- Page: setup-profile.html ---
let setupUser = null;

async function initSetupProfile() {
    const session = await requireAuth(['centre']);
    if (!session) return;
    setupUser = session.user;

    // Load existing centres for recovery dropdown
    try {
        const snap = await db.collection('centres').get();
        if (!snap.empty) {
            const sel = document.getElementById('existing-centre-select');
            const wrap = document.getElementById('link-existing-wrap');
            if (sel && wrap) {
                sel.innerHTML = '<option value="">-- Select your existing centre --</option>';
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.centreName && data.centreName !== 'Admin') {
                        sel.innerHTML += `<option value="${doc.id}">${data.centreName} (${data.branchCode || 'No Code'})</option>`;
                    }
                });
                wrap.style.display = 'block';
            }
        }
    } catch(e) {
        console.warn('Could not load existing centres', e);
    }
}

async function linkExistingCentre() {
    const sel = document.getElementById('existing-centre-select');
    const uid = sel.value;
    if (!uid) {
        showToast('Please select your centre from the list.', 'warning');
        return;
    }
    
    const btn = document.getElementById('link-centre-btn');
    btn.disabled = true; btn.textContent = 'Linking...';
    
    try {
        // Link the selected centre to the current Google Sheets username (which is stored in setupUser.uid)
        const currentUsername = localStorage.getItem('dsdc_user');
        
        // Update the OLD centre document with the new branchCode so it's found next time
        await db.collection('centres').doc(uid).set({
            branchCode: currentUsername
        }, { merge: true });
        
        // Update the local storage to use the OLD centre ID
        localStorage.setItem('dsdc_uid', uid);
        
        showToast('Data restored successfully!', 'success');
        setTimeout(() => window.top.location.href = 'centre-portal.html', 1000);
    } catch (e) {
        showToast('Failed to link centre: ' + e.message, 'error');
        btn.disabled = false; btn.textContent = 'Restore My Data';
    }
}

function goSetupStep(n) {
    const getV = (id) => document.getElementById(id).value.trim();
    if (n === 2) {
        if (!getV('centreName') || !getV('address') || !getV('phone') || !getV('centreEmail')) { showToast('Please fill all required fields.', 'error'); return; }
    }
    if (n === 3) {
        if (!getV('contactName') || !getV('contactMobile')) { showToast('Please fill all required fields.', 'error'); return; }
        buildSetupPreview();
    }
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById('step-' + i);
        if(step) step.style.display = i === n ? 'block' : 'none';
        const dot = document.getElementById('s' + i);
        if(dot) dot.className = 'step-dot' + (i < n ? ' done' : (i === n ? ' active' : ''));
        const line = document.getElementById('l' + i);
        if (i < 3 && line) line.className = 'step-line' + (i < n ? ' done' : '');
    }
}

function buildSetupPreview() {
    const getV = (id) => document.getElementById(id).value.trim();
    const pa = document.getElementById('preview-area');
    if(!pa) return;
    pa.innerHTML = `
        <div><strong>Centre Name:</strong> ${getV('centreName')}</div>
        <div><strong>Branch Code:</strong> ${getV('branchCode') || '—'}</div>
        <div><strong>Address:</strong> ${getV('address')}</div>
        <div><strong>Phone:</strong> ${getV('phone')}</div>
        <div><strong>Email:</strong> ${getV('centreEmail')}</div>
        <div><strong>BDE Name:</strong> ${getV('contactName')}</div>
        <div><strong>Designation:</strong> ${getV('designation') || '—'}</div>
        <div><strong>BDE Mobile:</strong> ${getV('contactMobile')}</div>
      `;
}

async function saveSetupProfileData() {
    const getV = (id) => document.getElementById(id).value.trim();
    const btn = document.getElementById('save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const data = {
            centreName: getV('centreName'), branchCode: getV('branchCode'),
            address: getV('address'), phone: getV('phone'), email: getV('centreEmail'),
            contactName: getV('contactName'), designation: getV('designation'),
            contactMobile: getV('contactMobile'), altContact: getV('altContact'),
            setupComplete: true, uid: setupUser.uid
        };
        await setDoc('centres', setupUser.uid, data);
        showToast('Centre profile saved!', 'success');
        setTimeout(() => window.top.location.href = 'centre-portal.html', 1200);
    } catch (e) {
        showToast('Error saving profile: ' + e.message, 'error');
        btn.disabled = false; btn.textContent = '🚀 Save & Continue';
    }
}

// --- Page: register.html (Candidate Registration) ---
async function loadPublicRegistrationForm() {
    try {
        const cSnap = await db.collection('centres').where('setupComplete', '==', true).get();
        const centres = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const cSel = document.getElementById('r-centre');
        if(cSel) {
            centres.forEach(c => {
                cSel.innerHTML += `<option value="${c.id}">${c.centreName} ${c.branchCode ? `(${c.branchCode})` : ''}</option>`;
            });
        }
    } catch (e) { console.error('Error loading config:', e); }
}

async function onPublicCentreSelect() {
    const cid = document.getElementById('r-centre').value;
    const cWrap = document.getElementById('course-wrap');
    const pSec = document.getElementById('personal-section');
    if (!cid) { if(cWrap) cWrap.style.display = 'none'; if(pSec) pSec.style.display = 'none'; return; }

    if(cWrap) cWrap.style.display = 'block';
    if(pSec) pSec.style.display = 'block';

    const crSel = document.getElementById('r-course');
    if(!crSel) return;
    crSel.innerHTML = '<option value="">Loading courses...</option>';

    const snap = await db.collection('courses').where('centreId', '==', cid).where('status', '==', 'active').get();
    const courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    crSel.innerHTML = '<option value="">-- Select Course --</option>';
    if (courses.length === 0) crSel.innerHTML = '<option value="">No active courses found</option>';
    else courses.forEach(c => crSel.innerHTML += `<option value="${c.id}">${c.name}</option>`);

    // Store globally for submission
    window._availableCourses = courses;
}

async function submitPublicRegistration() {
    const getV = (id) => document.getElementById(id).value.trim();
    const centreId = getV('r-centre');
    const courseId = getV('r-course');
    const name = getV('r-name');
    const mobile = getV('r-mobile');
    const qual = getV('r-qual');
    const addr = getV('r-addr');

    if (!centreId || !courseId || !name || !mobile || !qual || !addr) {
        showToast('Please fill all required fields marked with *', 'error'); return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Submitting...';

    const courseName = (window._availableCourses || []).find(c => c.id === courseId)?.name || '';

    const data = {
        centreId, courseId, name, mobile, qualification: qual, address: addr,
        courseName,
        email: getV('r-email'),
        aadhar: getV('r-aadhar'),
        dob: getV('r-dob'),
        gender: getV('r-gender'),
        status: 'pending', source: 'public',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await addDoc('students', data);
        document.getElementById('reg-form-wrap').style.display = 'none';
        document.getElementById('success-wrap').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
        btn.disabled = false; btn.textContent = 'Submit Registration';
    }
}
