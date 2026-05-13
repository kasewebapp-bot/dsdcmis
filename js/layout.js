// Shared sidebar layout helper for Centre Portal (SPA version)

let portalCtx = null; // Global context for the portal

function buildSidebar(centreData) {
  const name = centreData?.centreName || 'Loading...';
  const contact = centreData?.contactName || '';
  const ini = initials(name);

  const nav = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'courses', icon: '📚', label: 'Courses' },
    { id: 'batches', icon: '👥', label: 'Batches' },
    { id: 'trainers', icon: '🧑‍🏫', label: 'Trainers' },
    { id: 'students', icon: '🎓', label: 'Students' },
    { id: 'attendance', icon: '✅', label: 'Attendance' },
    { id: 'fees', icon: '💰', label: 'Fees' },
    { id: 'reports', icon: '📊', label: 'Reports' },
  ];

  const navHTML = nav.map(item => `
    <li class="nav-item" data-view="${item.id}">
      <a href="javascript:void(0)" onclick="navigatePortal('${item.id}')">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    </li>
  `).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <img src="https://res.cloudinary.com/dohsh2sal/image/upload/v1773303953/copy_of_district_skill_o5cnkk_47abf0.png" alt="DSDC Logo" style="width:42px;height:42px;border-radius:10px;background:#fff;padding:2px;object-fit:contain;">
        <div class="logo-text">
          <h2>DSDC</h2>
          <p>Centre Portal</p>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Navigation</div>
        <ul>${navHTML}</ul>
        <div class="nav-section-title" style="margin-top:12px;">Settings</div>
        <ul>
          <li class="nav-item" data-view="profile">
            <a href="javascript:void(0)" onclick="navigatePortal('profile')"><span class="nav-icon">⚙️</span><span>Centre Profile</span></a>
          </li>
          <li class="nav-item">
            <button onclick="logout()"><span class="nav-icon">🚪</span><span>Sign Out</span></button>
          </li>
        </ul>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${ini}</div>
          <div class="user-details">
            <h4>${name}</h4>
            <p>${contact || 'Centre Staff'}</p>
          </div>
        </div>
      </div>
    </aside>`;
}

/**
 * SPA View Switcher
 */
function navigatePortal(viewId) {
    // 1. Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if(activeItem) activeItem.classList.add('active');

    // 2. Hide all view sections
    document.querySelectorAll('.portal-view').forEach(view => view.style.display = 'none');

    // 3. Show target view
    const targetView = document.getElementById(`view-${viewId}`);
    if(targetView) {
        targetView.style.display = 'block';
        
        // 4. Update title
        const label = activeItem?.querySelector('span:last-child')?.textContent || viewId;
        const titleEl = document.getElementById('page-title');
        if(titleEl) titleEl.textContent = label;

        // 5. Update URL hash (optional, for state retention)
        window.location.hash = viewId;

        // 6. Run initialization logic
        initViewLogic(viewId);
    }
}

function initViewLogic(viewId) {
    console.log(`Initializing view: ${viewId}`);
    switch(viewId) {
        case 'dashboard': loadCentreDashboard(); break;
        case 'courses': loadCoursesPage(); break;
        case 'batches': loadBatchesPage(); break;
        case 'trainers': if(typeof loadTrainerPage === 'function') loadTrainerPage(); break;
        case 'students': loadStudentsPage(); break;
        case 'attendance': loadAttendancePage(); break;
        case 'fees': loadFeesPage(); break;
        case 'reports': loadCentreReportsPage(); break;
        case 'profile': loadProfilePage(); break;
    }
}

/**
 * Main Entry Point for SPA
 */
async function initPortal() {
  const session = await requireAuth(['centre']);
  if (!session) return;
  
  const centreData = await getDoc('centres', session.user.uid) || {};

  portalCtx = { session, centreData };

  // Render Sidebar
  const sidebarContainer = document.getElementById('sidebar-container');
  if(sidebarContainer) {
      sidebarContainer.innerHTML = buildSidebar(centreData);
  }

  // Handle Initial View from Hash or Default to Dashboard
  const initialView = window.location.hash.replace('#', '') || 'dashboard';
  navigatePortal(initialView);

  // Sync Global Header Time
  startClock();
}

/**
 * Legacy initPage Helper (for backward compatibility during migration)
 */
async function initPage(title) {
    if (portalCtx) return portalCtx;
    return await initPortal();
}
