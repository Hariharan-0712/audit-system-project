let currentUser = null;
let currentAuditId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    setupEventListeners();
});

// --- AUTH ---
async function checkSession() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            currentUser = await res.json();
            showApp();
        } else { 
            showLogin(); 
        }
    } catch (e) { 
        console.error("Session check failed", e);
        showLogin(); 
    }
}

function showLogin() {
    document.getElementById('view-login').classList.add('active');
    document.getElementById('app-layout').style.display = 'none';
}

function showApp() {
    document.getElementById('view-login').classList.remove('active');
    document.getElementById('app-layout').style.display = 'flex';
    setupUI();
    loadAudits();
}

function setupUI() {
    document.getElementById('user-display-name').innerText = currentUser.username;
    const roleBadge = document.getElementById('user-role-badge');
    roleBadge.innerText = currentUser.role;
    
    const isUser = currentUser.role === 'USER';
    const isAuditor = currentUser.role === 'AUDITOR';

    document.querySelectorAll('.user-only').forEach(el => {
        el.style.display = isUser ? 'flex' : 'none';
    });
    
    document.querySelectorAll('.auditor-only').forEach(el => {
        el.style.display = isAuditor ? 'flex' : 'none';
    });
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = event ? event.target : document.querySelector(`.tab-btn[onclick="switchAuthTab('${tab}')"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'login' ? 'none' : 'block';
}

function selectRole(role, btn) {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('reg-role').value = role;
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Logging in...";

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('login-username').value,
                password: document.getElementById('login-password').value
            })
        });
        
        const data = await res.json();

        if (res.ok) {
            currentUser = data.user;
            showApp();
            showNotification(`Welcome back, ${currentUser.username}!`, 'success');
        } else {
            showNotification(data.error || 'Invalid credentials', 'error');
        }
    } catch(err) {
        showNotification('Network error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Creating...";

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('reg-username').value,
                password: document.getElementById('reg-password').value,
                role: document.getElementById('reg-role').value
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            showNotification(`Account created successfully for ${data.username}! Please login.`, 'success');
            switchAuthTab('login');
            // Clear form
            document.getElementById('register-form').reset();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Error creating account', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => {
        currentUser = null;
        showLogin();
        showNotification('Logged out successfully.', 'info');
    });
}

// --- NAVIGATION ---
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${viewName}'`)) {
            btn.classList.add('active');
        }
    });

    const titles = { 'dashboard': 'Dashboard', 'verify': 'Verify Tool', 'create': 'New Request', 'detail': 'Audit Details' };
    document.getElementById('page-title').innerText = titles[viewName] || viewName;
    
    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// --- DATA LOGIC: USER CREATES REQUEST ---
async function handleCreateRequest(e) {
    e.preventDefault();
    
    const title = document.getElementById('new-title').value;
    const vendor = document.getElementById('new-vendor').value;
    const amount = document.getElementById('new-amount').value;
    
    // Invoice Specific Inputs
    const invoiceNumber = document.getElementById('new-inv-number').value;
    const invoiceDate = document.getElementById('new-inv-date').value;
    const dueDate = document.getElementById('new-due-date').value;
    const hasInvoice = document.getElementById('chk-invoice').checked;
    
    if(!amount || parseFloat(amount) <= 0) {
        return showNotification("Please enter a valid amount", 'error');
    }

    const attachments = { invoice: hasInvoice };
    const purchase_data = { 
        vendor, 
        amount, 
        attachments, 
        invoiceNumber, 
        invoiceDate, 
        dueDate,
        purchase_rate: amount, 
        approved_rate: 0 
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        const res = await fetch('/api/audits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title, 
                type: "Purchase Request", 
                require_purchase_rate: true, 
                purchase_data 
            })
        });

        if (res.ok) {
            const data = await res.json();
            showNotification(`Audit #${data.id} created successfully. Assigned to Auditor: ${data.assignedToName}`, 'success');
            document.getElementById('create-audit-form').reset();
            switchView('dashboard');
            loadAudits();
        } else {
            const errData = await res.json();
            showNotification(errData.error || 'Failed to submit request', 'error');
        }
    } catch (err) {
        showNotification('Network error, please try again', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- DATA LOGIC: LOAD AUDITS ---
async function loadAudits() {
    const filterVal = document.getElementById('status-filter') ? document.getElementById('status-filter').value : 'all';
    const res = await fetch('/api/audits');
    let audits = await res.json();
    
    // Client-side filtering
    if(filterVal !== 'all') {
        audits = audits.filter(a => a.status === filterVal);
    }

    const tbody = document.getElementById('audit-table-body');
    tbody.innerHTML = '';
    
    if (!audits || audits.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('audit-table').style.display = 'none';
        updateStats(0, 0);
        return;
    }
    
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('audit-table').style.display = 'table';

    audits.forEach(a => {
        const tr = document.createElement('tr');
        const amount = a.purchase_data?.amount || 'N/A';
        tr.innerHTML = `
            <td>#${a.id}</td>
            <td><strong>${a.title}</strong><br><small style="color:#777">by ${a.creator_name || 'Unknown'}</small></td>
            <td>₹${amount}</td>
            <td><span class="badge badge-${a.status}">${formatStatus(a.status)}</span></td>
            <td><button class="btn-sm btn-secondary" onclick="openAuditDetail(${a.id})">View</button></td>
        `;
        tbody.appendChild(tr);
    });
    
    // Recalculate total stats based on all audits (ignoring filter for count)
    const allAuditsRes = await fetch('/api/audits');
    const allAudits = await allAuditsRes.json();
    updateStats(allAudits.length, allAudits.filter(a => a.status === 'PENDING_REVIEW').length);
}

function updateStats(total, pending) {
    document.getElementById('count-total').innerText = total;
    document.getElementById('count-pending').innerText = pending;
}

function formatStatus(status) {
    const statusMap = {
        'PENDING_DATA': 'Draft',
        'PENDING_REVIEW': 'Pending Review',
        'VERIFIED': 'Verified',
        'REJECTED': 'Rejected'
    };
    return statusMap[status] || status.replace(/_/g, ' ');
}

// --- VERIFY TOOL (AUDITOR) - CLIENT SIDE SIMULATION ---
function handleVerify(e) {
    e.preventDefault();
    
    const trans = document.getElementById('verify-trans').value;
    const amount = document.getElementById('verify-amount').value;
    const vendor = document.getElementById('verify-vendor').value;
    const auth = document.getElementById('verify-auth').value;
    
    // Invoice Verification Inputs
    const verifyInvNum = document.getElementById('verify-inv-number').value;
    const verifyInvDate = document.getElementById('verify-inv-date').value;
    
    const hasInvoice = document.getElementById('verify-chk-invoice').checked;

    let risk = "Low";
    let status = "Verified";
    let actions = [];
    let observations = [];
    
    let invCheck = hasInvoice ? "Verified" : "Missing";
    let invNumCheck = verifyInvNum ? "Present" : "Missing";
    let invDateCheck = verifyInvDate ? "Recorded" : "Missing";

    // Logic based on Invoice presence and details
    if (!hasInvoice) {
        risk = "High";
        status = "Rejected";
        observations.push("Invoice document not provided.");
        actions.push("Upload valid invoice immediately.");
    } else if (!verifyInvNum || !verifyInvDate) {
        risk = "Medium";
        status = "Flagged";
        observations.push("Invoice provided, but key details are missing in verification.");
        if(!verifyInvNum) actions.push("Enter the Invoice Number.");
        if(!verifyInvDate) actions.push("Enter the Invoice Date.");
    } else {
        observations.push("Invoice details match records. Documentation complete.");
    }

    const reportHtml = `
        <div class="report-box">
            <div class="report-header">
                <h3>Audit Verification Report</h3>
                <div class="report-status">${status}</div>
            </div>
            <p><strong>Risk Level:</strong> ${risk}</p>
            <hr style="margin: 15px 0; border:0; border-top:1px solid #ddd;">
            
            <h4>Invoice Checklist</h4>
            <ul class="check-list">
                <li><strong>Document Attached:</strong> ${invCheck}</li>
                <li><strong>Invoice Number:</strong> ${invNumCheck} ${verifyInvNum ? `(${verifyInvNum})` : ''}</li>
                <li><strong>Invoice Date:</strong> ${invDateCheck} ${verifyInvDate ? `(${verifyInvDate})` : ''}</li>
            </ul>

            <h4 style="margin-top:20px;">Regulatory Compliance</h4>
            <ul class="check-list">
                <li><strong>GST (Sec 16):</strong> GSTIN Valid. ITC eligible.</li>
                <li><strong>CARO 2020:</strong> Asset verified.</li>
            </ul>

            <h4 style="margin-top:20px;">Auditor Observations</h4>
            <div class="observation-box">${observations.join(' ')}</div>

            <h4 style="margin-top:20px;">Required Action</h4>
            <ul class="check-list">
                ${actions.length > 0 ? actions.map(a => `<li style="color:var(--danger);">${a}</li>`).join('') : '<li style="color:var(--success);">No immediate action required.</li>'}
            </ul>
        </div>
    `;

    const container = document.getElementById('report-container');
    container.innerHTML = reportHtml;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
    
    showNotification("Verification Report Generated.", 'info');
}

// --- DETAIL VIEW & REVIEW ---
async function openAuditDetail(id) {
    currentAuditId = id;
    const res = await fetch('/api/audits');
    const audits = await res.json();
    const audit = audits.find(a => a.id === id);
    
    if (!audit) return showNotification("Audit not found", 'error');

    document.getElementById('detail-title').innerText = audit.title;
    document.getElementById('detail-status').className = `badge badge-${audit.status}`;
    document.getElementById('detail-status').innerText = formatStatus(audit.status);

    const content = document.getElementById('detail-content');
    const pData = audit.purchase_data || {};
    
    const attachmentsDisplay = `
        <div style="margin-top:10px;">
            <strong>Attachments:</strong><br>
            Invoice: ${pData.attachments?.invoice ? 'Yes' : 'No'}
        </div>
    `;

    content.innerHTML = `
        <p><strong>Vendor:</strong> ${pData.vendor || 'N/A'}</p>
        <p><strong>Amount:</strong> ₹${pData.amount || 'N/A'}</p>
        <p><strong>Created By:</strong> ${audit.creator_name || 'Unknown'}</p>
        <hr style="margin: 15px 0; border:0; border-top:1px solid #eee;">
        <div style="background:#f8f9fa; padding:10px; border-radius:4px;">
            <strong>Invoice Number:</strong> ${pData.invoiceNumber || 'N/A'}<br>
            <strong>Invoice Date:</strong> ${pData.invoiceDate || 'N/A'}<br>
            <strong>Due Date:</strong> ${pData.dueDate || 'N/A'}
        </div>
        ${attachmentsDisplay}
        <hr style="margin: 15px 0; border:0; border-top:1px solid #eee;">
    `;

    // Auditor Actions
    if(currentUser.role === 'AUDITOR' && audit.status === 'PENDING_REVIEW') {
        content.innerHTML += `
            <div style="background:#f8f9fa; padding:15px; border-radius:6px;">
                <h4>Auditor Decision</h4>
                <div class="form-group">
                    <label>Notes (Optional)</label>
                    <textarea id="admin-notes" rows="2" placeholder="Add feedback for the user..."></textarea>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" style="background:var(--success)" onclick="submitReview('APPROVED')">Approve</button>
                    <button class="btn-primary" style="background:var(--danger)" onclick="submitReview('REJECTED')">Reject</button>
                </div>
            </div>
        `;
    }
    
    // User Feedback
    if(currentUser.role === 'USER' && audit.status === 'REJECTED') {
         content.innerHTML += `
            <div class="observation-box" style="border-left-color: var(--danger);">
                <strong>Rejection Reason:</strong> ${audit.admin_notes || 'Please contact auditor.'}
            </div>
        `;
    }
    
    if(currentUser.role === 'USER' && audit.status === 'VERIFIED') {
         content.innerHTML += `
            <div class="observation-box" style="border-left-color: var(--success);">
                <strong>Approved:</strong> This transaction has been verified.
            </div>
        `;
    }

    switchView('detail');
}

async function submitReview(status) {
    const admin_notes = document.getElementById('admin-notes')?.value || "";
    
    const res = await fetch(`/api/audits/${currentAuditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes })
    });

    if (res.ok) {
        const data = await res.json();
        if(status === 'APPROVED') {
            showNotification(`Audit #${currentAuditId} Approved! Notified User: ${data.notifiedUser}`, 'success');
        } else {
            showNotification(`Audit #${currentAuditId} Rejected. Notified User: ${data.notifiedUser}`, 'error');
        }
        switchView('dashboard');
        loadAudits();
    } else {
        showNotification("Failed to update audit", 'error');
    }
}

// --- UTILS ---
function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('create-audit-form').addEventListener('submit', handleCreateRequest);
    document.getElementById('verify-form').addEventListener('submit', handleVerify);
}

function showNotification(msg, type = 'info') {
    const el = document.getElementById('notification');
    el.innerText = msg;
    
    // Color coding based on type
    el.style.background = 'var(--sidebar-bg)';
    if(type === 'success') el.style.background = 'var(--success)';
    if(type === 'error') el.style.background = 'var(--danger)';
    if(type === 'warning') el.style.background = 'var(--warning)';
    
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
}