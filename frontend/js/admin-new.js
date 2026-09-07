// =============================================
// admin.js – Admin Panel Logic
// =============================================

const API_BASE =
    window.location.hostname === "localhost"
        ? "http://localhost:5000/api"
        : "https://campu-bot-rag-implemented.onrender.com/api";

// =============================================
// SECTION SWITCHING
// =============================================
function showSection(name) {

    document
        .querySelectorAll('.admin-section')
        .forEach(s => s.classList.remove('active'));

    document
        .querySelectorAll('.admin-nav-btn')
        .forEach(b => b.classList.remove('active'));

    document
        .getElementById(`section-${name}`)
        .classList.add('active');

    event.currentTarget.classList.add('active');

    if (name === 'dashboard') loadDashboard();
    if (name === 'faqs') loadFAQs();
    if (name === 'logs') loadLogs();
    if (name === 'feedback') loadFeedback();
    if (name === 'users') loadUsers();
    if (name === 'add-admin') showAddAdmin();
    if (name === 'admins') loadAdmins();
    if (name === 'upload-pdf') loadDocuments();
    if (name === 'study-notes') loadStudyNotes(); // ← ADD THIS LINE
}
// ── STUDY NOTES: SUBMIT HANDLER ──────────────────────────────────
async function submitStudyNoteUpload() {
    const status = document.getElementById("studyUploadStatus");
    const fileInput = document.getElementById("studyNoteFile");
    const title = document.getElementById("studyNoteTitle").value.trim();
    const subject = document.getElementById("studyNoteSubject").value.trim();
    const semester = document.getElementById("studyNoteSemester").value.trim();
 
    if (!title || !subject) {
        status.innerHTML = "❌ Title and Subject are required.";
        return;
    }
    if (!fileInput.files.length) {
        status.innerHTML = "❌ Please select a PDF.";
        return;
    }
 
    uploadStudyNoteWithProgress(fileInput.files[0], { title, subject, semester }, status, fileInput);
}
 
// ── STUDY NOTES: UPLOAD WITH PROGRESS (mirrors uploadPDFWithProgress) ──
function uploadStudyNoteWithProgress(file, meta, status, fileInput) {
    let progressWrap = document.getElementById("studyUploadProgressWrap");
    if (!progressWrap) {
        progressWrap = document.createElement("div");
        progressWrap.id = "studyUploadProgressWrap";
        progressWrap.className = "upload-progress-wrap";
        progressWrap.innerHTML = `
            <div class="upload-progress-track">
                <div class="upload-progress-fill" id="studyUploadProgressFill"></div>
            </div>
            <div class="upload-progress-text" id="studyUploadProgressText">0%</div>
        `;
        status.insertAdjacentElement("afterend", progressWrap);
    }
 
    const fill = document.getElementById("studyUploadProgressFill");
    const text = document.getElementById("studyUploadProgressText");
 
    progressWrap.style.display = "block";
    fill.style.width = "0%";
    text.textContent = "0%";
    status.innerHTML = "⏳ Uploading...";
 
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", meta.title);
    formData.append("subject", meta.subject);
    formData.append("semester", meta.semester || "");
 
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/study/admin/upload`);
 
    const token = CampusAuth.getAdminToken();
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
 
    xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.round((e.loaded / e.total) * 100);
        fill.style.width = `${percent}%`;
        text.textContent = `${percent}%`;
    });
 
    xhr.onload = () => {
        fill.style.width = "100%";
        text.textContent = "Processing…";
 
        try {
            const data = JSON.parse(xhr.responseText);
 
            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                status.innerHTML = `✅ Uploaded — ${data.note.chunkCount} chunks indexed.`;
                document.getElementById("studyNoteTitle").value = "";
                document.getElementById("studyNoteSubject").value = "";
                document.getElementById("studyNoteSemester").value = "";
            } else {
                status.innerHTML = "❌ " + (data.message || "Upload failed.");
            }
        } catch (err) {
            status.innerHTML = "❌ Upload failed.";
        }
 
        fileInput.value = "";
        setTimeout(() => { progressWrap.style.display = "none"; }, 1500);
        loadStudyNotes();
    };
 
    xhr.onerror = () => {
        status.innerHTML = "❌ Upload failed (network error).";
        progressWrap.style.display = "none";
    };
 
    xhr.send(formData);
}
 
// ── STUDY NOTES: LIST (mirrors loadDocuments) ────────────────────
// ── STUDY NOTES: STATE (in-memory list + current sort) ────────────
// Notes are fetched once and kept here; search/sort just re-render
// from this array instead of re-hitting the server every keystroke.
let studyNotesData = [];
let studyNotesSort = { field: "createdAt", direction: "desc" };

// ── STUDY NOTES: FETCH (mirrors loadDocuments) ─────────────────────
async function loadStudyNotes() {
    const container = document.getElementById("studyNotesListContainer");
    if (!container) return;

    container.innerHTML = "<p style='color:var(--text-muted)'>Loading notes…</p>";

    try {
        const res = await CampusAuth.adminFetch("/study/admin/notes");

        if (res.status === 401 || res.status === 403) {
            container.innerHTML =
                "<p style='color:var(--danger)'>⚠️ Session expired, or you don't have the studyNotes permission. Refresh and log in again.</p>";
            return;
        }

        const data = await res.json();

        if (!data.success) {
            container.innerHTML =
                `<p style='color:var(--danger)'>⚠️ Could not load notes: ${escapeHtml(data.message || "Unknown error")}</p>`;
            return;
        }

        studyNotesData = data.notes;
        renderStudyNotesTable();
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p style='color:var(--danger)'>⚠️ Network error loading notes.</p>";
    }
}

// ── STUDY NOTES: SORT HEADER CLICK ─────────────────────────────────
function sortStudyNotes(field) {
    if (studyNotesSort.field === field) {
        studyNotesSort.direction = studyNotesSort.direction === "asc" ? "desc" : "asc";
    } else {
        studyNotesSort = { field, direction: "asc" };
    }
    renderStudyNotesTable();
}

function sortIcon(field) {
    if (studyNotesSort.field !== field) return "";
    return studyNotesSort.direction === "asc" ? " ▲" : " ▼";
}

// ── STUDY NOTES: RENDER (applies current search + sort) ────────────
function renderStudyNotesTable() {
    const container = document.getElementById("studyNotesListContainer");
    if (!container) return;

    const searchEl = document.getElementById("studyNotesSearch");
    const query = (searchEl?.value || "").trim().toLowerCase();

    let rows = studyNotesData;

    if (query) {
        rows = rows.filter(
            (n) =>
                n.title.toLowerCase().includes(query) ||
                n.subject.toLowerCase().includes(query)
        );
    }

    const { field, direction } = studyNotesSort;
    rows = [...rows].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (field === "createdAt") {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else if (field === "chunkCount") {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else {
            valA = (valA || "").toString().toLowerCase();
            valB = (valB || "").toString().toLowerCase();
        }

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
    });

    if (studyNotesData.length === 0) {
        container.innerHTML = "<p style='color:var(--text-muted)'>No notes uploaded yet.</p>";
        return;
    }

    if (rows.length === 0) {
        container.innerHTML = "<p style='color:var(--text-muted)'>No notes match your search.</p>";
        return;
    }

    const th = (label, field) => `
        <th style="padding:8px 6px;cursor:pointer;user-select:none" onclick="sortStudyNotes('${field}')">
            ${label}${sortIcon(field)}
        </th>
    `;

    // Wrapped in its own horizontally-scrollable container so a wide
    // table (6 columns + action buttons) scrolls sideways ON MOBILE
    // without forcing the whole admin page to overflow horizontally.
    // The table gets a min-width so columns keep breathing room
    // instead of squishing/wrapping into each other — the scroll
    // container is what makes that safe on narrow screens.
    // Desktop is unaffected: at normal admin-panel widths the table
    // fits within the container and no scrollbar appears.
    container.innerHTML = `
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%">
        <table style="width:100%;min-width:640px;border-collapse:collapse">
            <thead>
                <tr style="text-align:left;border-bottom:1px solid var(--border,#333)">
                    ${th("Title", "title")}
                    ${th("Subject", "subject")}
                    ${th("Semester", "semester")}
                    ${th("Chunks", "chunkCount")}
                    ${th("Uploaded", "createdAt")}
                    <th style="padding:8px 6px">Action</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(note => `
                    <tr style="border-bottom:1px solid var(--border,#2a2a2a)">
                        <td style="padding:8px 6px">${escapeHtml(note.title)}</td>
                        <td style="padding:8px 6px">${escapeHtml(note.subject)}</td>
                        <td style="padding:8px 6px">${escapeHtml(note.semester || "-")}</td>
                        <td style="padding:8px 6px">${note.chunkCount}</td>
                        <td style="padding:8px 6px;white-space:nowrap">${new Date(note.createdAt).toLocaleDateString()}</td>
                        <td style="padding:8px 6px;white-space:nowrap">
                            <button class="btn-primary" style="padding:4px 12px;font-size:0.85rem;margin-right:6px" onclick="viewStudyNote('${note._id}', '${escapeHtml(note.sourceFileName || note.title)}')">View</button>
                            <button class="btn-primary" style="background:var(--danger);padding:4px 12px;font-size:0.85rem" onclick="deleteStudyNote('${note._id}')">Delete</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        </div>
    `;
}

// ── STUDY NOTES: VIEW ───────────────────────────────────────────────
async function viewStudyNote(id, filename) {
    try {
        const res = await CampusAuth.adminFetch(`/study/admin/notes/view/${id}`);

        if (!res.ok) {
            showAlert("Could not load this PDF.");
            return;
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");

        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
        console.error(err);
        showAlert("Failed to open PDF (network error).");
    }
}
// ── STUDY NOTES: DELETE ───────────────────────────────────────────
function deleteStudyNote(id) {
    showConfirm("Delete this note permanently? This removes it from the Study chatbot too.", async () => {
        try {
            const res = await CampusAuth.adminFetch(`/study/admin/notes/${id}`, { method: "DELETE" });
            const data = await res.json();

            if (data.success) {
                loadStudyNotes();
            } else {
                showAlert("Delete failed: " + (data.message || "Unknown error"));
            }
        } catch (err) {
            console.error(err);
            showAlert("Delete failed (network error).");
        }
    });
}
 
// // =============================================
// // THEME TOGGLE
// // =============================================
// document
//     .getElementById('themeToggle')
//     .addEventListener('click', () => {

//         const current = document.body.dataset.theme;

//         document.body.dataset.theme =
//             current === 'dark'
//                 ? 'light'
//                 : 'dark';

//         document
//             .querySelector('.theme-icon')
//             .textContent =
//             current === 'dark'
//                 ? '🌙'
//                 : '☀️';
//     });

// =============================================
// LOAD DASHBOARD
// =============================================
async function loadDashboard() {

    try {

        const res =
            await fetch(`${API_BASE}/stats`);

        const data =
            await res.json();

        document.getElementById('statFaqs').textContent =
            data.faqs || FAQ_DB.length;

        document.getElementById('statConvos').textContent =
            data.conversations || 0;

        document.getElementById('statFeedback').textContent =
            data.feedbackCount || 0;

        document.getElementById('statRating').textContent =
            data.avgRating
                ? `${data.avgRating}⭐`
                : '—';

        // Recent activity
        const logsRes =
            await fetch(`${API_BASE}/logs?limit=5`);

        const logs =
            await logsRes.json();

        const container =
            document.getElementById('recentActivity');

        if (logs.length) {

            container.innerHTML =
                logs.map(log => `

          <div class="log-item">

            <div class="log-time">
              ${new Date(log.timestamp).toLocaleString()}
            </div>

            <div class="log-q">
              👤 ${log.userMessage}
            </div>

            <div class="log-a">
              🎓 ${log.botReply?.substring(0, 120)}...
            </div>

          </div>

        `).join('');

        } else {

            container.innerHTML =
                '<p style="color:var(--text-muted)">No conversations yet.</p>';
        }

    } catch (err) {

        console.error(err);

        document.getElementById('statFaqs').textContent =
            FAQ_DB.length;

        document.getElementById('statConvos').textContent =
            'Offline';
    }
}

// =============================================
// LOAD FAQS
// =============================================
async function loadFAQs() {

    try {

        const res =
            await fetch(`${API_BASE}/faqs`);

        let dbFaqs = [];

        if (res.ok) {

            dbFaqs =
                await res.json();
        }

        renderFAQTable(dbFaqs);

    } catch (err) {

        console.error(err);

        renderFAQTable([]);
    }
}
// =============================================
// RENDER FAQ TABLE
// =============================================
function renderFAQTable(faqs) {

    const tbody =
        document.getElementById('faqTableBody');

    if (!faqs.length) {

        tbody.innerHTML = `
      <tr>
        <td colspan="4"
            style="text-align:center;padding:24px">
          No FAQs found.
        </td>
      </tr>
    `;

        return;
    }

    tbody.innerHTML =
        faqs.map(faq => `

      <tr>

        <td>
          ${faq.answers?.en?.substring(0, 80) || 'N/A'}...
        </td>

        <td>
          <span class="tag">
            ${faq.category || '—'}
          </span>
        </td>

        <td>
          ${(faq.keywords || []).join(', ')}
        </td>

        <td>

          <button
            class="btn-sm danger"
            onclick="deleteFAQ('${faq._id}')">

            🗑 Delete

          </button>

        </td>

      </tr>

    `).join('');
}

// =============================================
// ADD FAQ
// =============================================
async function addFAQ() {

    const keywords =
        document
            .getElementById('faqKeywords')
            .value
            .split(',')
            .map(k => k.trim())
            .filter(Boolean);

    const category =
        document.getElementById('faqCategory').value;

    const en =
        document.getElementById('faqAnswerEn').value.trim();

    const hi =
        document.getElementById('faqAnswerHi').value.trim();

    const mr =
        document.getElementById('faqAnswerMr').value.trim();

    const ta =
        document.getElementById('faqAnswerTa').value.trim();

    const te =
        document.getElementById('faqAnswerTe').value.trim();

    const msg =
        document.getElementById('addFaqMsg');

    // Validation
    if (!keywords.length || !en) {

        msg.textContent =
            '⚠️ Please fill required fields';

        msg.style.color = 'red';

        return;
    }

    const payload = {

        keywords,

        category,

        intent:
            keywords[0].replace(/\s+/g, '_'),

        answers: {
            en,
            hi,
            mr
        }
    };

    try {

        console.log('Sending FAQ:', payload);

        const res =
            await fetch(`${API_BASE}/faqs`, {

                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(payload)
            });

        const data =
            await res.json();

        console.log(data);

        if (res.ok) {

            msg.textContent =
                '✅ FAQ added successfully!';

            msg.style.color =
                'lime';

            // Clear form
            document.getElementById('faqKeywords').value = '';
            document.getElementById('faqAnswerEn').value = '';
            document.getElementById('faqAnswerHi').value = '';
            document.getElementById('faqAnswerMr').value = '';

            loadFAQs();

        } else {

            msg.textContent =
                `❌ ${data.error || 'Failed to add FAQ'}`;

            msg.style.color =
                'red';
        }

    } catch (err) {

        console.error(err);

        msg.textContent =
            '❌ Backend connection failed';

        msg.style.color =
            'red';
    }
}

// =============================================
// DELETE FAQ
// =============================================
async function deleteFAQ(id) {

    if (!confirm('Delete this FAQ?'))
        return;

    // Prevent deleting local FAQs
    if (id.startsWith('local-')) {

        alert('Cannot delete built-in FAQs.');

        return;
    }

    try {

        await fetch(`${API_BASE}/faqs/${id}`, {
            method: 'DELETE'
        });

        loadFAQs();

    } catch (err) {

        console.error(err);

        alert('Delete failed.');
    }
}

// =============================================
// LOAD LOGS
// =============================================
async function loadLogs() {

    const container =
        document.getElementById('logsContainer');

    try {

        const res =
            await fetch(`${API_BASE}/logs`);

        const logs =
            await res.json();

        if (!logs.length) {

            container.innerHTML =
                '<p>No logs yet.</p>';

            return;
        }

        container.innerHTML =
            logs.map(log => `

        <div class="log-item">

          <div class="log-time">
            ${new Date(log.timestamp).toLocaleString()}
          </div>

          <div class="log-q">
            👤 ${log.userMessage}
          </div>

          <div class="log-a">
            🎓 ${log.botReply?.substring(0, 200)}
          </div>

        </div>

      `).join('');

    } catch (err) {

        console.error(err);

        container.innerHTML =
            '<p>Backend offline.</p>';
    }
}

// =============================================
// LOAD FEEDBACK
// =============================================
async function loadFeedback() {

    const container =
        document.getElementById('feedbackContainer');

    try {

        const res =
            await fetch(`${API_BASE}/feedback`);

        const items =
            await res.json();

        if (!items.length) {

            container.innerHTML =
                '<p>No feedback yet.</p>';

            return;
        }

        container.innerHTML =
            items.map(item => `

        <div class="log-item">

          <div class="log-time">
            ${new Date(
                item.timestamp || item.createdAt
            ).toLocaleString()}
          </div>

          <div class="log-q">
            Rating:
            ${'⭐'.repeat(item.rating || 0)}
          </div>

          ${item.comment
                    ? `<div class="log-a">💬 ${item.comment}</div>`
                    : ''
                }

        </div>

      `).join('');

    } catch (err) {

        console.error(err);

        container.innerHTML =
            '<p>Backend offline.</p>';
    }
}
// =============================================
// LOAD USERS
// =============================================
async function loadUsers() {

    const container =
        document.getElementById('usersContainer');

    try {

        const res =
            await CampusAuth.adminFetch('/admin/users');

        const data =
            await res.json();

        const users =
            data.data || [];

        if (!users.length) {

            container.innerHTML =
                '<p>No users registered yet.</p>';

            return;
        }

        container.innerHTML = `

      <table class="faq-table">

        <thead>

          <tr>

            <th>Name</th>

            <th>Email</th>

            <th>Department</th>

            <th>Year</th>

            <th>Status</th>

            <th>Joined</th>

            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          ${users.map(user => `

            <tr>

              <td>${user.name}</td>

              <td>${user.email}</td>

              <td>${user.department || '—'}</td>

              <td>${user.year || '—'}</td>

              <td>
                ${user.isActive
                ? '🟢 Active'
                : '🔴 Disabled'}
              </td>

              <td>
                ${new Date(
                    user.createdAt
                ).toLocaleDateString()}
              </td>

              <td>


  <button
    class="btn-sm danger"
    onclick="toggleUserStatus(
      '${user._id}',
      ${user.isActive}
    )">

    ${user.isActive
                ? 'Disable'
                : 'Enable'}

  </button>

  <button
    class="btn-sm danger"
    style="margin-left:6px"
    onclick="deleteUser('${user._id}')">

    Delete

  </button>

</td>

              </td>

            </tr>

          `).join('')}

        </tbody>

      </table>

    `;

    } catch (err) {

        console.error(err);

        container.innerHTML =
            '<p>Failed to load users.</p>';
    }
}
// =============================================
// ENABLE / DISABLE USER
// =============================================
async function toggleUserStatus(id, currentStatus) {

    const action =
        currentStatus
            ? 'disable'
            : 'enable';

    if (
        !confirm(
            `Are you sure you want to ${action} this user?`
        )
    ) return;

    try {

        const res =
            await CampusAuth.adminFetch(
                `/admin/users/${id}`,
                {

                    method: 'PUT',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        isActive: !currentStatus
                    })
                }
            );

        const data =
            await res.json();

        if (res.ok) {

            alert(data.message);

            loadUsers();

        } else {

            alert(data.message || 'Action failed');
        }

    } catch (err) {

        console.error(err);

        alert('Backend error');
    }
}

// =============================================
// DELETE USER
// =============================================
async function deleteUser(id) {

    if (
        !confirm(
            'Permanently delete this user?'
        )
    ) return;

    try {

        const res =
            await CampusAuth.adminFetch(
                `/admin/users/${id}`,
                {
                    method: 'DELETE'
                }
            );

        const data =
            await res.json();

        if (res.ok) {

            alert(data.message);

            loadUsers();

        } else {

            alert(data.message || 'Delete failed');
        }

    } catch (err) {

        console.error(err);

        alert('Backend error');
    }
}
// =============================================
// INITIAL DASHBOARD LOAD
// =============================================
window.addEventListener('load', () => {

    setTimeout(() => {

        loadDashboard();

    }, 300);

});
// =============================================
// SUPERADMIN CHECK
// =============================================
const currentAdmin =
    CampusAuth.getAdmin();

if (
    currentAdmin &&
    currentAdmin.role === 'superadmin'
) {

    // Add Admin button
    const btn =
        document.getElementById(
            'addAdminNavBtn'
        );

    if (btn)
        btn.style.display = 'flex';

    // Manage Admins button
    const manageBtn =
        document.getElementById(
            'manageAdminsBtn'
        );

    if (manageBtn)
        manageBtn.style.display = 'flex';
}

// =============================================
// SHOW ADD ADMIN SECTION
// =============================================
function showAddAdmin() {

    const admin =
        CampusAuth.getAdmin();

    if (
        admin.role !== 'superadmin'
    ) {

        alert(
            'Only superadmin can create admins.'
        );

        return;
    }
}

// =============================================
// CREATE ADMIN
// =============================================
async function createAdmin() {

    const name =
        document.getElementById(
            'adminName'
        ).value.trim();

    const email =
        document.getElementById(
            'adminEmail'
        ).value.trim();

    const password =
        document.getElementById(
            'adminPassword'
        ).value.trim();

    const role =
        document.getElementById(
            'adminRole'
        ).value;

    const msg =
        document.getElementById(
            'addAdminMsg'
        );

    if (
        !name ||
        !email ||
        !password
    ) {

        msg.textContent =
            '⚠️ Fill all fields';

        msg.style.color = 'red';

        return;
    }

    try {

        const res =
            await CampusAuth.adminFetch(
                '/admin/create-admin',
                {

                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        name,
                        email,
                        password,
                        role,


                    })
                }
            );

        const data =
            await res.json();

        if (res.ok) {

            msg.textContent =
                '✅ Admin created successfully';

            msg.style.color =
                'lime';

            document.getElementById(
                'adminName'
            ).value = '';

            document.getElementById(
                'adminEmail'
            ).value = '';

            document.getElementById(
                'adminPassword'
            ).value = '';

        } else {

            msg.textContent =
                `❌ ${data.message}`;

            msg.style.color =
                'red';
        }

    } catch (err) {

        console.error(err);

        msg.textContent =
            '❌ Backend error';

        msg.style.color =
            'red';
    }
}
// =============================================
// CHANGE ADMIN PASSWORD
// =============================================
async function changeAdminPassword() {

    const currentPassword =
        document.getElementById(
            'currentAdminPassword'
        ).value.trim();

    const newPassword =
        document.getElementById(
            'newAdminPassword'
        ).value.trim();

    const msg =
        document.getElementById(
            'changePasswordMsg'
        );

    if (
        !currentPassword ||
        !newPassword
    ) {

        msg.textContent =
            '⚠️ Fill all fields';

        msg.style.color = 'red';

        return;
    }

    try {

        const res =
            await CampusAuth.adminFetch(
                '/admin/change-password',
                {
                    method: 'PUT',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                }
            );

        const data =
            await res.json();

        if (res.ok) {

            msg.textContent =
                '✅ Password updated';

            msg.style.color = 'lime';

            document.getElementById(
                'currentAdminPassword'
            ).value = '';

            document.getElementById(
                'newAdminPassword'
            ).value = '';

        } else {

            msg.textContent =
                `❌ ${data.message}`;

            msg.style.color = 'red';
        }

    } catch (err) {

        console.error(err);

        msg.textContent =
            '❌ Backend error';

        msg.style.color = 'red';
    }
}

// =============================================
// LOAD ADMINS
// =============================================
// =============================================
// LOAD ADMINS
// =============================================
// =============================================
// PASTE: replace your ENTIRE existing loadAdmins() function with
// everything below (state vars + loadAdmins + all new helpers).
// Reuses your EXISTING toggleAdminStatus, deleteAdmin, createAdmin
// functions untouched — no backend/API changes, this only rebuilds
// how the list is rendered.
// =============================================

// ── MANAGE ADMINS: STATE ──────────────────────────────────────────
let adminsData = [];
let adminsPage = 1;
const ADMINS_PAGE_SIZE = 10;
let adminsSort = "name_asc";
let adminsHasCreatedAt = false; // only offer Newest/Oldest if the data actually has it
let adminsOpenMenuId = null; // which row's "⋮" menu is open (mobile)

// ── MANAGE ADMINS: FETCH ──────────────────────────────────────────
async function loadAdmins() {
    const listContainer = document.getElementById('adminsContainer') || document.getElementById('adminsListContainer');

    try {
        const res = await CampusAuth.adminFetch('/admin/admins');
        const data = await res.json();
        adminsData = data.data || [];

        adminsHasCreatedAt = adminsData.some(a => !!a.createdAt);
        ensureCreatedAtSortOptions();

        adminsPage = 1;
        renderAdminsUI();
    } catch (err) {
        console.error(err);
        if (listContainer) listContainer.innerHTML = '<p style="color:var(--danger)">Failed to load admins.</p>';
    }
}

// Adds "Newest first" / "Oldest first" options to the sort dropdown
// only if the fetched admins actually carry a createdAt field —
// never invents a sort option for data that doesn't exist.
function ensureCreatedAtSortOptions() {
    const sortSelect = document.getElementById('adminsSortSelect');
    if (!sortSelect || !adminsHasCreatedAt) return;
    if (sortSelect.querySelector('option[value="created_desc"]')) return; // already added

    const newest = document.createElement('option');
    newest.value = 'created_desc';
    newest.textContent = 'Newest first';
    const oldest = document.createElement('option');
    oldest.value = 'created_asc';
    oldest.textContent = 'Oldest first';
    sortSelect.appendChild(newest);
    sortSelect.appendChild(oldest);
}

// Called by the search input (oninput) and sort dropdown (onchange) —
// both count as "the view changed", so we jump back to page 1.
function onAdminsSearchOrSortChange() {
    const sortSelect = document.getElementById('adminsSortSelect');
    if (sortSelect) adminsSort = sortSelect.value;
    adminsPage = 1;
    renderAdminsUI();
}

function goToAdminsPage(n) {
    adminsPage = n;
    renderAdminsUI();
}

// ── MANAGE ADMINS: FILTER + SORT + PAGINATE + RENDER ──────────────
function renderAdminsUI() {
    const summaryEl = document.getElementById('adminsSummary');
    const listContainer = document.getElementById('adminsListContainer') || document.getElementById('adminsContainer');
    if (!listContainer) return;

    // Summary always reflects the FULL dataset, not just what search
    // currently filters — it's an overview, not a filtered count.
    const total = adminsData.length;
    const activeCount = adminsData.filter(a => a.isActive).length;
    const disabledCount = total - activeCount;
    if (summaryEl) {
        summaryEl.textContent = `Total: ${total} · Active: ${activeCount} · Disabled: ${disabledCount}`;
    }

    // 1. SEARCH
    const searchEl = document.getElementById('adminsSearch');
    const query = (searchEl?.value || '').trim().toLowerCase();
    let rows = adminsData;
    if (query) {
        rows = rows.filter(a =>
            (a.name || '').toLowerCase().includes(query) ||
            (a.email || '').toLowerCase().includes(query)
        );
    }

    // 2. SORT
    rows = [...rows].sort((a, b) => {
        switch (adminsSort) {
            case 'name_asc': return (a.name || '').localeCompare(b.name || '');
            case 'name_desc': return (b.name || '').localeCompare(a.name || '');
            case 'email_asc': return (a.email || '').localeCompare(b.email || '');
            case 'email_desc': return (b.email || '').localeCompare(a.email || '');
            case 'status_active': return (b.isActive === true) - (a.isActive === true);
            case 'status_disabled': return (a.isActive === true) - (b.isActive === true);
            case 'created_desc': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            case 'created_asc': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            default: return 0;
        }
    });

    // 3. PAGINATE
    const totalFiltered = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / ADMINS_PAGE_SIZE));
    if (adminsPage > totalPages) adminsPage = totalPages;
    const start = (adminsPage - 1) * ADMINS_PAGE_SIZE;
    const pageItems = rows.slice(start, start + ADMINS_PAGE_SIZE);

    if (total === 0) {
        listContainer.innerHTML = '<p style="color:var(--text-muted)">No admins found.</p>';
        return;
    }
    if (totalFiltered === 0) {
        listContainer.innerHTML = '<p style="color:var(--text-muted)">No admins match your search.</p>';
        return;
    }

    const statusBadge = (a) => a.isActive ? '🟢 Active' : '🔴 Disabled';

    const studyNotesCell = (a) => {
        if ((a.permissions || []).includes('all')) {
            return '<span style="color:var(--text-muted);font-size:0.8rem">Full access</span>';
        }
        const checked = (a.permissions || []).includes('studyNotes') ? 'checked' : '';
        return `<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="checkbox" ${checked} onchange="toggleStudyNotesAccess('${a._id}', this.checked, this)" />
                </label>`;
    };

    // ── DESKTOP TABLE (unchanged structure from your original) ──
    const desktopTable = `
      <div class="admins-desktop-view" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table class="faq-table" style="min-width:720px">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Study Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map(admin => `
              <tr>
                <td>${escapeHtml(admin.name)}</td>
                <td>${escapeHtml(admin.email)}</td>
                <td>${escapeHtml(admin.role)}</td>
                <td>${statusBadge(admin)}</td>
                <td>${studyNotesCell(admin)}</td>
                <td>
                  <button class="btn-sm danger" onclick="toggleAdminStatus('${admin._id}', ${admin.isActive})">
                    ${admin.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button class="btn-sm danger" style="margin-left:6px" onclick="deleteAdmin('${admin._id}')">
                    Delete
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // ── MOBILE COMPACT ROWS (no big per-admin cards) ──
    const mobileList = `
      <div class="admins-mobile-view">
        ${pageItems.map(admin => `
          <div class="admin-compact-row" style="border-bottom:1px solid var(--border,#2a2a2a);padding:10px 4px;position:relative">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <strong style="font-size:0.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(admin.name)}</strong>
              <button
                aria-label="Actions"
                onclick="toggleAdminRowMenu('${admin._id}', event)"
                style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;padding:2px 8px;flex-shrink:0"
              >⋮</button>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(admin.email)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(admin.role)} · ${statusBadge(admin)}</div>

            <div
  id="adminRowMenu-${admin._id}"
  onclick="event.stopPropagation()"
  style="display:${adminsOpenMenuId === admin._id ? 'block' : 'none'};position:absolute;right:4px;top:36px;background:var(--bg-elevated,#171a23);border:1px solid var(--border,#333);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:20;min-width:170px;padding:6px"
>
              <button class="btn-sm danger" style="width:100%;margin-bottom:4px" onclick="toggleAdminStatus('${admin._id}', ${admin.isActive}); toggleAdminRowMenu(null)">
                ${admin.isActive ? 'Disable' : 'Enable'}
              </button>
              <button class="btn-sm danger" style="width:100%;margin-bottom:4px" onclick="deleteAdmin('${admin._id}'); toggleAdminRowMenu(null)">
                Delete
              </button>
              ${(admin.permissions || []).includes('all')
                ? '<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 4px">Study Notes: Full access</div>'
                : `<label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;padding:6px 4px;cursor:pointer">
                     <input type="checkbox" ${(admin.permissions || []).includes('studyNotes') ? 'checked' : ''}
                       onchange="toggleStudyNotesAccess('${admin._id}', this.checked, this)" />
                     Study Notes access
                   </label>`
              }
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // ── PAGINATION ──
    const rangeStart = totalFiltered === 0 ? 0 : start + 1;
    const rangeEnd = Math.min(start + ADMINS_PAGE_SIZE, totalFiltered);

    const pageNumbers = buildAdminsPageNumbers(adminsPage, totalPages);
    const pagination = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:14px;font-size:0.85rem">
        <span style="color:var(--text-muted)">Showing ${rangeStart}–${rangeEnd} of ${totalFiltered}</span>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <button class="btn-sm" ${adminsPage === 1 ? 'disabled' : ''} onclick="goToAdminsPage(${adminsPage - 1})">Previous</button>
          ${pageNumbers.map(p =>
            p === '...'
              ? `<span style="padding:0 6px;color:var(--text-muted)">…</span>`
              : `<button class="btn-sm ${p === adminsPage ? 'active' : ''}" style="${p === adminsPage ? 'background:var(--accent);color:white' : ''}" onclick="goToAdminsPage(${p})">${p}</button>`
          ).join('')}
          <button class="btn-sm" ${adminsPage === totalPages ? 'disabled' : ''} onclick="goToAdminsPage(${adminsPage + 1})">Next</button>
        </div>
      </div>
    `;

    listContainer.innerHTML = desktopTable + mobileList + pagination;
}

// Builds a compact page-number list like: 1 ... 4 5 [6] 7 8 ... 42
function buildAdminsPageNumbers(current, totalPages) {
    const pages = [];
    const windowSize = 1;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= current - windowSize && p <= current + windowSize)) {
            pages.push(p);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }
    return pages;
}

// Opens/closes the "⋮" menu for one mobile row; closes any other
// open menu first (only one open at a time).
function toggleAdminRowMenu(adminId, event) {
    if (event) event.stopPropagation();
    adminsOpenMenuId = (adminsOpenMenuId === adminId) ? null : adminId;
    renderAdminsUI();
}

// Close an open row menu when tapping anywhere else on the page.
document.addEventListener('click', () => {
    if (adminsOpenMenuId !== null) {
        adminsOpenMenuId = null;
        renderAdminsUI();
    }
});

// ── RESPONSIVE CSS: desktop table vs mobile compact rows ──
// Injected once — toggles which of the two pre-rendered views is
// visible based on screen width. Both are built in the same render
// pass above; only visibility switches, so there's no separate
// data-fetch or duplicated logic path for mobile vs desktop.
(function injectAdminsResponsiveStyle() {
    if (document.getElementById('admins-responsive-style')) return;
    const style = document.createElement('style');
    style.id = 'admins-responsive-style';
    style.textContent = `
        .admins-mobile-view { display: none; }
        @media (max-width: 768px) {
            .admins-desktop-view { display: none; }
            .admins-mobile-view { display: block; }
        }
    `;
    document.head.appendChild(style);
})();

// ── STUDY NOTES: toggle a specific admin's access from the Manage
// Admins panel — replaces the need to run grantStudyPermission.js
// in a terminal for every new teacher account.
async function toggleStudyNotesAccess(adminId, enabled, checkboxEl) {
    checkboxEl.disabled = true;

    try {
        const res = await CampusAuth.adminFetch(`/admin/admins/${adminId}/study-notes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
        });

        const data = await res.json();

        if (!data.success) {
           showAlert('Failed: ' + (data.message || 'Unknown error'));
            checkboxEl.checked = !enabled; // revert the visual toggle
        }
        // On success we leave the checkbox as the user set it —
        // no need to reload the whole admins table for one field.
    } catch (err) {
        console.error(err);
        showAlert('Network error — could not update Study Notes access.');
        checkboxEl.checked = !enabled;
    } finally {
        checkboxEl.disabled = false;
    }
}
// =============================================
// ENABLE / DISABLE ADMIN
// =============================================
async function toggleAdminStatus(id, currentStatus) {
    try {
        const res = await CampusAuth.adminFetch(`/admin/admins/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !currentStatus }),
        });

        const data = await res.json();

        showAlert(data.message);
        loadAdmins();
    } catch (err) {
        console.error(err);
        showAlert('Backend error');
    }
}

// =============================================
// DELETE ADMIN
// =============================================
function deleteAdmin(id) {
    showConfirm('Delete this admin permanently?', async () => {
        try {
            const res = await CampusAuth.adminFetch(`/admin/admins/${id}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            showAlert(data.message);
            loadAdmins();
        } catch (err) {
            console.error(err);
            showAlert('Backend error');
        }
    });
}
async function uploadPDF() {

    const fileInput = document.getElementById("pdfFile");
    const status = document.getElementById("uploadStatus");

    if (!fileInput.files.length) {
        status.innerHTML = "❌ Please select a PDF.";
        return;
    }

    const file = fileInput.files[0];

    // ── REPLACE-EXISTING CHECK ──────────────────────────────────
    // If a document with this same name is already in the list,
    // confirm with the admin before overwriting it — re-uploading
    // silently would otherwise be surprising (and previously caused
    // duplicate/stale entries piling up in the AI's index).
    try {
        const listRes = await CampusAuth.adminFetch("/rag/documents");
        const listData = await listRes.json();

        const alreadyExists =
            listData.success &&
            listData.documents.some(doc => doc.name === file.name);

        if (alreadyExists) {
            const confirmed = confirm(
                `"${file.name}" already exists. Replace the existing document?`
            );
            if (!confirmed) {
                status.innerHTML = "Upload cancelled.";
                return;
            }
        }
    } catch (err) {
        // If the check itself fails, don't block the upload — just
        // proceed without the replace confirmation.
        console.error("Could not check existing documents:", err);
    }

    uploadPDFWithProgress(file, status, fileInput);
}

// ── UPLOAD WITH REAL PROGRESS ────────────────────────────────────
// fetch() has no upload-progress event, so we use XMLHttpRequest
// instead (only for this one call) to show real percentages while
// the file streams to the server, plus a visual progress bar.
function uploadPDFWithProgress(file, status, fileInput) {

    // Build (or reuse) the progress bar UI right under the status text.
    let progressWrap = document.getElementById("uploadProgressWrap");
    if (!progressWrap) {
        progressWrap = document.createElement("div");
        progressWrap.id = "uploadProgressWrap";
        progressWrap.className = "upload-progress-wrap";
        progressWrap.innerHTML = `
            <div class="upload-progress-track">
                <div class="upload-progress-fill" id="uploadProgressFill"></div>
            </div>
            <div class="upload-progress-text" id="uploadProgressText">0%</div>
        `;
        status.insertAdjacentElement("afterend", progressWrap);
    }

    const fill = document.getElementById("uploadProgressFill");
    const text = document.getElementById("uploadProgressText");

    progressWrap.style.display = "block";
    fill.style.width = "0%";
    text.textContent = "0%";
    status.innerHTML = "⏳ Uploading...";

    const formData = new FormData();
    formData.append("pdf", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/rag/upload`);

    // Same Authorization header CampusAuth.adminFetch() would add —
    // XHR needs it set manually since we're not using fetch here.
    const token = CampusAuth.getAdminToken();
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    // Live progress as the file streams to the server.
    xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.round((e.loaded / e.total) * 100);
        fill.style.width = `${percent}%`;
        text.textContent = `${percent}%`;
    });

    xhr.onload = () => {

        // Upload reached the server — now it's parsing/OCR-ing/
        // embedding, which can take a while for scanned PDFs. Reflect
        // that so the bar doesn't look "stuck" at 100%.
        fill.style.width = "100%";
        text.textContent = "Processing…";

        try {
            const data = JSON.parse(xhr.responseText);

            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                status.innerHTML = "✅ PDF uploaded successfully.";
            } else {
                status.innerHTML = "❌ " + (data.message || "Upload failed.");
            }
        } catch (err) {
            status.innerHTML = "❌ Upload failed.";
        }

        fileInput.value = "";
        setTimeout(() => { progressWrap.style.display = "none"; }, 1500);
        loadDocuments();
    };

    xhr.onerror = () => {
        status.innerHTML = "❌ Upload failed (network error).";
        progressWrap.style.display = "none";
    };

    xhr.send(formData);
}

// =============================================
// DOCUMENT MANAGER
// ---------------------------------------------
// Lists every PDF that's been uploaded for RAG, and lets an admin
// preview or delete one. Deleting removes BOTH the file on disk and
// its indexed chunks in ChromaDB (handled server-side), so a deleted
// document immediately stops being cited in chat answers too.
// =============================================

async function loadDocuments() {

    const container = document.getElementById("documentsListContainer");

    if (!container) return; // section not on this page — nothing to do

    container.innerHTML = "<p style='color:var(--text-muted)'>Loading documents…</p>";

    try {

        const res = await CampusAuth.adminFetch("/rag/documents");

        // Token expired/invalid — don't show "no documents", since
        // the documents are still there; the request just failed.
        if (res.status === 401 || res.status === 403) {
            container.innerHTML =
                "<p style='color:var(--danger)'>⚠️ Your admin session expired. Please refresh the page and log in again to see your documents.</p>";
            return;
        }

        const data = await res.json();

        if (!data.success) {
            // A real server-side error — show it plainly instead of
            // silently claiming there are no documents.
            container.innerHTML =
                `<p style='color:var(--danger)'>⚠️ Could not load documents: ${escapeHtml(data.error || "Unknown error")}. <a href="#" onclick="loadDocuments();return false;" style="color:var(--accent)">Retry</a></p>`;
            return;
        }

        if (data.documents.length === 0) {
            container.innerHTML =
                "<p style='color:var(--text-muted)'>No documents uploaded yet.</p>";
            return;
        }

        const rows = data.documents.map(doc => {

            const uploadedDate = new Date(doc.uploadedAt).toLocaleDateString(
                undefined,
                { day: "2-digit", month: "short", year: "numeric" }
            );

            return `
                <tr>
                    <td>📄 ${escapeHtml(doc.name)}</td>
                    <td><span class="tag">${doc.sizeKB} KB</span></td>
                    <td>${uploadedDate}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-sm" onclick="viewDocument('${doc.fileId}')">
                                👁 View
                            </button>
                            <button class="btn-sm danger" onclick="deleteDocument('${doc.fileId}', '${escapeHtml(doc.name)}')">
                                🗑 Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        container.innerHTML = `
            <table class="faq-table">
                <thead>
                    <tr>
                        <th>Document</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    } catch (err) {

        console.error(err);
        container.innerHTML =
            "<p style='color:var(--danger)'>Failed to load documents.</p>";

    }
}

function viewDocument(fileId) {
    // Opens the PDF in a new tab. The view route itself is
    // admin-protected, but a plain <a>/window.open can't attach an
    // Authorization header — so instead we fetch it (with the header
    // CampusAuth adds automatically) and open the returned blob.
    CampusAuth.adminFetch(`/rag/documents/view/${fileId}`)
        .then(async res => {
            if (!res.ok) {
                // Something went wrong server-side (auth failure,
                // file missing, etc.) — read the real error message
                // instead of silently opening it as if it were a PDF.
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.message || `Request failed (status ${res.status})`);
            }
            return res.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        })
        .catch(err => {
            console.error(err);
            alert(`Could not open document: ${err.message}`);
        });
}

async function deleteDocument(fileId, displayName) {

    if (!confirm(`Delete "${displayName}"? This also removes it from the chatbot's knowledge.`)) {
        return;
    }

    try {

        const res = await CampusAuth.adminFetch(
            `/rag/documents/${fileId}`,
            { method: "DELETE" }
        );

        const data = await res.json();

        alert(data.message);

        loadDocuments(); // refresh the list

    } catch (err) {

        console.error(err);
        alert("Delete failed.");

    }
}

// Small helper so document names can never break the HTML we inject
// (e.g. a filename containing < or & characters).
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
// =============================================
// PASTE: add these two functions anywhere in admin-new.js (once).
// They replace window.confirm() / window.alert() with a modal that
// matches the dark theme, using the shell added in
// custom-modal.PATCH.html.
//
// USAGE — drop-in style replacement pattern:
//   Old:  if (confirm("Delete this?")) { doDelete(); }
//   New:  showConfirm("Delete this?", () => { doDelete(); });
//
//   Old:  alert("Something failed");
//   New:  showAlert("Something failed");
// =============================================

function showAlert(message) {
    const overlay = document.getElementById('customModalOverlay');
    const messageEl = document.getElementById('customModalMessage');
    const actionsEl = document.getElementById('customModalActions');

    messageEl.textContent = message;
    actionsEl.innerHTML = `<button class="btn-primary" style="width:auto;padding:8px 20px" onclick="closeCustomModal()">OK</button>`;
    overlay.style.display = 'flex';
}

function showConfirm(message, onConfirm) {
    const overlay = document.getElementById('customModalOverlay');
    const messageEl = document.getElementById('customModalMessage');
    const actionsEl = document.getElementById('customModalActions');

    messageEl.textContent = message;
    actionsEl.innerHTML = `
        <button class="btn-sm" onclick="closeCustomModal()">Cancel</button>
        <button class="btn-sm danger" id="customModalConfirmBtn">Confirm</button>
    `;
    overlay.style.display = 'flex';

    // Attach fresh each time so old handlers from a previous call
    // never stack up on repeated confirm() usage.
    document.getElementById('customModalConfirmBtn').onclick = () => {
        closeCustomModal();
        onConfirm();
    };
}

function closeCustomModal() {
    document.getElementById('customModalOverlay').style.display = 'none';
}

// Close on backdrop click (clicking outside the modal box)
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'customModalOverlay') {
        closeCustomModal();
    }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCustomModal();
});