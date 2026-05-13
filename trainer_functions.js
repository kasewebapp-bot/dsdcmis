/**
 * DSDC MIS - Trainer Functions
 * Consolidated from trainers.html
 */

let allTrainersList = [], trainerCentreId = '';

async function loadTrainerPage() {
    const ctx = await initPage('Trainers');
    if (!ctx) return;
    trainerCentreId = ctx.session.user.uid;

    db.collection('trainers').where('centreId', '==', trainerCentreId).onSnapshot(snap => {
        allTrainersList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        renderTrainers();
        buildTrainerSpecFilter();
    });
}

function buildTrainerSpecFilter() {
    const specs = [...new Set(allTrainersList.map(t => t.specialization).filter(Boolean))];
    const sel = document.getElementById('f-spec');
    if (!sel) return;
    const v = sel.value;
    sel.innerHTML = '<option value="">All</option>' + specs.map(s => `<option value="${s}">${s}</option>`).join('');
    sel.value = v;
}

function renderTrainers() {
    const searchEl = document.getElementById('srch');
    const specEl = document.getElementById('f-spec');
    if (!searchEl || !specEl) return;

    const s = searchEl.value.toLowerCase();
    const sp = specEl.value;
    
    let data = allTrainersList.filter(t =>
        (!s || (t.name || '').toLowerCase().includes(s) || (t.email || '').toLowerCase().includes(s)) &&
        (!sp || t.specialization === sp)
    );
    
    const grid = document.getElementById('trainer-grid');
    if (!grid) return;
    
    if (!data.length) { 
        grid.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);grid-column:1/-1;">No trainers found</div>'; 
        return; 
    }
    
    grid.innerHTML = data.map(t => `
    <div class="card" style="padding:20px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div class="user-avatar" style="width:48px;height:48px;font-size:18px;">${initials(t.name)}</div>
        <div>
          <h4 style="font-weight:700;color:var(--text);">${t.name}</h4>
          <p style="font-size:12px;color:var(--text-muted);">${t.empId || '—'} • ${t.specialization || '—'}</p>
        </div>
        <span class="badge badge-${t.status === 'active' ? 'success' : 'grey'}" style="margin-left:auto;">${t.status || 'active'}</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:5px;">
        <div>📱 <span>${t.mobile || '—'}</span></div>
        <div>📧 <span>${t.email || '—'}</span></div>
        <div>🎓 <span>${t.qualification || '—'} • ${t.experience || 0} yrs exp</span></div>
        <div>👤 <span>Login: <strong>${t.username || '—'}</strong></span></div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;">
        <button class="btn btn-warning btn-sm" style="flex:1;" onclick="editTrainer('${t.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="delTrainer('${t.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function clearTrainerFilters() { 
    const srch = document.getElementById('srch');
    const spec = document.getElementById('f-spec');
    if(srch) srch.value = ''; 
    if(spec) spec.value = ''; 
    renderTrainers(); 
}

function openAddTrainerModal() {
    ['edit-id', 't-name', 't-empid', 't-mobile', 't-email', 't-spec', 't-qual', 't-exp', 't-addr', 't-username', 't-password'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const statusEl = document.getElementById('t-status');
    if(statusEl) statusEl.value = 'active';
    
    const titleEl = document.getElementById('t-modal-title');
    if(titleEl) titleEl.textContent = '🧑‍🏫 Add Trainer';
    
    openModal('trainer-modal');
}

function editTrainer(id) {
    const t = allTrainersList.find(x => x.id === id);
    if (!t) return;
    
    const titleEl = document.getElementById('t-modal-title');
    if(titleEl) titleEl.textContent = '✏️ Edit Trainer';
    
    const fields = {
        'edit-id': id,
        't-name': t.name || '',
        't-empid': t.empId || '',
        't-mobile': t.mobile || '',
        't-email': t.email || '',
        't-spec': t.specialization || '',
        't-qual': t.qualification || '',
        't-exp': t.experience || '',
        't-status': t.status || 'active',
        't-addr': t.address || '',
        't-username': t.username || '',
        't-password': ''   // never pre-fill password; leave blank to keep existing
    };
    
    for (const [fid, val] of Object.entries(fields)) {
        const el = document.getElementById(fid);
        if(el) el.value = val;
    }
    
    openModal('trainer-modal');
}

async function saveTrainer() {
    const name = document.getElementById('t-name').value.trim();
    const mobile = document.getElementById('t-mobile').value.trim();
    const spec = document.getElementById('t-spec').value.trim();
    const username = document.getElementById('t-username')?.value.trim() || '';
    const newPassword = document.getElementById('t-password')?.value || '';
    
    if (!name || !mobile || !spec) { 
        showToast('Fill required fields (Name, Mobile, Specialization).', 'error'); 
        return; 
    }
    if (!username) {
        showToast('Please set a username for this trainer.', 'error');
        return;
    }
    
    const btn = document.getElementById('save-t-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    
    const eid = document.getElementById('edit-id').value;

    // Check username uniqueness (skip self when editing)
    const existingSnap = await db.collection('trainers').where('username', '==', username).get();
    const existingDocs = existingSnap.docs.filter(d => d.id !== eid);
    if (existingDocs.length > 0) {
        showToast('Username already taken. Choose another.', 'error');
        btn.disabled = false; btn.textContent = 'Save Trainer';
        return;
    }
    
    const data = {
        name, mobile, specialization: spec, centreId: trainerCentreId,
        empId: document.getElementById('t-empid').value.trim(),
        email: document.getElementById('t-email').value.trim(),
        qualification: document.getElementById('t-qual').value.trim(),
        experience: Number(document.getElementById('t-exp').value) || 0,
        status: document.getElementById('t-status').value,
        address: document.getElementById('t-addr').value.trim(),
        username
    };

    // Only update password if a new one was entered
    if (newPassword) {
        data.trainerPassword = newPassword;
    }
    
    try {
        if (eid) { 
            await updateDoc('trainers', eid, data); 
            
            // Sync password update to Google Sheet
            if (newPassword) {
                try {
                    fetch(SHEET_BACKUP_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({
                            sheet: 'Passwords',
                            action: 'updatePassword',
                            username: username,
                            newPassword: newPassword,
                            name: name
                        })
                    });
                } catch(e) { console.warn('Could not update Passwords sheet', e); }
            }
            
            showToast('Trainer updated!', 'success'); 
        } else { 
            if (!newPassword) {
                showToast('Please set a password for the new trainer.', 'error');
                btn.disabled = false; btn.textContent = 'Save Trainer';
                return;
            }
            await addDoc('trainers', data); 
            
            // Append to Passwords sheet
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
                            Password: newPassword
                        }]
                    })
                });
            } catch(e) { console.warn('Could not add to Passwords sheet', e); }
            
            showToast('Trainer added!', 'success'); 
        }
        closeModal('trainer-modal');
    } catch (e) { 
        showToast('Error: ' + e.message, 'error'); 
    }
    btn.disabled = false; btn.textContent = 'Save Trainer';
}

async function delTrainer(id) {
    if (!confirm('Delete this trainer?')) return;
    await deleteDoc('trainers', id); 
    showToast('Trainer deleted.', 'success');
}

function exportTrainersData() {
    const data = allTrainersList.map(t => ({ 'Name': t.name, 'Emp ID': t.empId, 'Mobile': t.mobile, 'Email': t.email, 'Specialization': t.specialization, 'Qualification': t.qualification, 'Experience': t.experience, 'Status': t.status, 'Username': t.username }));
    exportToExcel(data, 'DSDC_Trainers');
}
