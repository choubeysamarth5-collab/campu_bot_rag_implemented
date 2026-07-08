// =============================================
// admin.js – Admin Panel Logic
// =============================================

const API_BASE = 'http://localhost:5000/api';

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
}

// =============================================
// THEME TOGGLE
// =============================================
document
    .getElementById('themeToggle')
    .addEventListener('click', () => {

        const current = document.body.dataset.theme;

        document.body.dataset.theme =
            current === 'dark'
                ? 'light'
                : 'dark';

        document
            .querySelector('.theme-icon')
            .textContent =
            current === 'dark'
                ? '🌙'
                : '☀️';
    });

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
async function loadAdmins() {

    const container =
        document.getElementById(
            'adminsContainer'
        );

    try {

        const res =
            await CampusAuth.adminFetch(
                '/admin/admins'
            );

        const data =
            await res.json();

        const admins =
            data.data || [];

        container.innerHTML = `

      <table class="faq-table">

        <thead>

          <tr>

            <th>Name</th>

            <th>Email</th>

            <th>Role</th>

            <th>Status</th>

            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          ${admins.map(admin => `

            <tr>

              <td>${admin.name}</td>

              <td>${admin.email}</td>

              <td>${admin.role}</td>

              <td>

                ${admin.isActive
                ? '🟢 Active'
                : '🔴 Disabled'}

              </td>

              <td>

                <button
                  class="btn-sm danger"
                  onclick="toggleAdminStatus(
                    '${admin._id}',
                    ${admin.isActive}
                  )">

                  ${admin.isActive
                ? 'Disable'
                : 'Enable'}

                </button>

                <button
                  class="btn-sm danger"
                  style="margin-left:6px"
                  onclick="deleteAdmin(
                    '${admin._id}'
                  )">

                  Delete

                </button>

              </td>

            </tr>

          `).join('')}

        </tbody>

      </table>
    `;

    } catch (err) {

        console.error(err);

        container.innerHTML =
            '<p>Failed to load admins.</p>';
    }
}
// =============================================
// ENABLE / DISABLE ADMIN
// =============================================
async function toggleAdminStatus(
    id,
    currentStatus
) {

    try {

        const res =
            await CampusAuth.adminFetch(
                `/admin/admins/${id}`,
                {
                    method: 'PUT',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        isActive: !currentStatus
                    })
                }
            );

        const data =
            await res.json();

        alert(data.message);

        loadAdmins();

    } catch (err) {

        console.error(err);

        alert('Backend error');
    }
}

// =============================================
// DELETE ADMIN
// =============================================
async function deleteAdmin(id) {

    if (
        !confirm(
            'Delete this admin permanently?'
        )
    ) return;

    try {

        const res =
            await CampusAuth.adminFetch(
                `/admin/admins/${id}`,
                {
                    method: 'DELETE'
                }
            );

        const data =
            await res.json();

        alert(data.message);

        loadAdmins();

    } catch (err) {

        console.error(err);

        alert('Backend error');
    }
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
        const data = await res.json();

        if (!data.success || data.documents.length === 0) {
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
                            <button class="btn-sm" onclick="viewDocument('${encodeURIComponent(doc.savedName)}')">
                                👁 View
                            </button>
                            <button class="btn-sm danger" onclick="deleteDocument('${encodeURIComponent(doc.savedName)}', '${escapeHtml(doc.name)}')">
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

function viewDocument(savedName) {
    // Opens the PDF in a new tab. The view route itself is
    // admin-protected, but a plain <a>/window.open can't attach an
    // Authorization header — so instead we fetch it (with the header
    // CampusAuth adds automatically) and open the returned blob.
    CampusAuth.adminFetch(`/rag/documents/view/${savedName}`)
        .then(res => res.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        })
        .catch(err => {
            console.error(err);
            alert("Could not open document.");
        });
}

async function deleteDocument(savedName, displayName) {

    if (!confirm(`Delete "${displayName}"? This also removes it from the chatbot's knowledge.`)) {
        return;
    }

    try {

        const res = await CampusAuth.adminFetch(
            `/rag/documents/${savedName}`,
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