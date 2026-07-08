// =====================================================================
// js/devPanel.js  –  Developer Panel Frontend Logic
// ---------------------------------------------------------------------
// Talks to the backend's superadmin-only /api/dev/* routes to power
// every section of the hidden Developer Panel: System Status, Storage
// Management, Vector DB Management, AI Provider Status, API Tester,
// Developer Logs, Server Information, Error Monitor, Cache Management.
// =====================================================================

async function loadDeveloperPanel() {

    try {

        const [systemRes, storageRes] = await Promise.all([
            CampusAuth.adminFetch("/dev/system"),
            CampusAuth.adminFetch("/dev/storage"),
        ]);

        // If the logged-in admin isn't a superadmin, the backend
        // returns 403 on every /dev/* route — show the access-denied
        // card instead of a half-broken page.
        if (systemRes.status === 403 || storageRes.status === 403) {
            document.getElementById("accessDenied").style.display = "block";
            document.getElementById("devContent").style.display = "none";
            return;
        }

        const system = await systemRes.json();
        const storage = await storageRes.json();

        document.getElementById("devContent").style.display = "block";

        renderSystemInfo(system);
        renderServerInfo(system);
        renderStorage(storage);

        // These sections load independently so one failing (e.g.
        // ChromaDB down) doesn't block the rest of the page.
        loadVectorDB();
        loadAiStatus();
        loadLogs("all");
        loadCacheStatus();

    } catch (err) {

        console.error(err);
        alert("Could not load developer panel data.");

    }
}

// ── SYSTEM STATUS ────────────────────────────────────────────────────
function renderSystemInfo(data) {

    document.getElementById("statNode").textContent = data.node || "—";
    document.getElementById("statUptime").textContent = data.uptimeMinutes ?? "—";
    document.getElementById("statMemory").textContent = data.memoryUsedMB ?? "—";

    document.getElementById("statMongo").textContent =
        data.mongo?.connected ? "✅ Up" : "❌ Down";

    document.getElementById("statChroma").textContent =
        data.chroma?.connected ? "✅ Up" : "❌ Down";

    const envRows = Object.entries(data.env || {}).map(([key, value]) => {
        const display = typeof value === "boolean"
            ? (value ? "✅ Set" : "❌ Missing")
            : value;
        return `<tr><td>${key}</td><td>${display}</td></tr>`;
    }).join("");

    document.getElementById("envTableBody").innerHTML = envRows;
}

// ── SERVER INFORMATION ───────────────────────────────────────────────
function renderServerInfo(data) {

    const s = data.server || {};

    const rows = [
        ["Hostname", s.hostname],
        ["Process ID (PID)", s.pid],
        ["Port", s.port],
        ["CPU Cores", s.cpuCores],
        ["Total Memory", `${s.totalMemoryMB} MB`],
        ["Free Memory", `${s.freeMemoryMB} MB`],
        ["Platform", data.platform],
        ["Server Started At", s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"],
    ].map(([label, value]) => `<tr><td>${label}</td><td>${value ?? "—"}</td></tr>`).join("");

    document.getElementById("serverInfoBody").innerHTML = rows;
}

// ── STORAGE MANAGEMENT ───────────────────────────────────────────────
function renderStorage(data) {

    // Disk space bar
    const diskBar = document.getElementById("diskUsageBar");
    if (data.disk && !data.disk.error) {
        diskBar.innerHTML = `
            <div class="upload-progress-track">
                <div class="upload-progress-fill" style="width:${data.disk.usedPercent}%"></div>
            </div>
            <div class="upload-progress-text">
                ${data.disk.usedGB} GB used of ${data.disk.totalGB} GB (${data.disk.freeGB} GB free) — ${data.disk.usedPercent}%
            </div>
        `;
    } else {
        diskBar.innerHTML = `<p style="color:var(--text-dim)">Disk stats unavailable.</p>`;
    }

    const rows = [
        `<tr><td>📁 Uploaded PDFs</td><td>${data.uploads.fileCount} files — ${data.uploads.sizeKB} KB</td></tr>`,
        `<tr><td>🧠 ChromaDB (indexed chunks)</td><td>${
            data.chroma.connected ? `${data.chroma.chunkCount} chunks` : "⚠️ Not connected"
        }</td></tr>`,
        `<tr><td>🗄️ MongoDB Data Size</td><td>${
            data.mongoStats && !data.mongoStats.error ? `${data.mongoStats.dataSizeMB} MB (indexes: ${data.mongoStats.indexSizeMB} MB)` : "—"
        }</td></tr>`,
        `<tr><td>📋 FAQs</td><td>${data.mongoCollections.faqs}</td></tr>`,
        `<tr><td>💬 Chat Logs</td><td>${data.mongoCollections.chatLogs}</td></tr>`,
        `<tr><td>⭐ Feedback Entries</td><td>${data.mongoCollections.feedback}</td></tr>`,
        `<tr><td>👤 Users</td><td>${data.mongoCollections.users}</td></tr>`,
        `<tr><td>🛡 Admins</td><td>${data.mongoCollections.admins}</td></tr>`,
    ].join("");

    document.getElementById("storageTableBody").innerHTML = rows;
}

async function clearEverything() {
    if (!confirm(
        "This clears uploaded PDFs, the ChromaDB knowledge base, chat logs, " +
        "and feedback entries — everything except FAQs, Users, and Admins. " +
        "This cannot be undone. Continue?"
    )) return;

    const msg = document.getElementById("dangerZoneMsg");
    msg.textContent = "Working…";

    try {
        const res = await CampusAuth.adminFetch("/dev/storage/all", { method: "DELETE" });
        const data = await res.json();
        msg.textContent = data.message + " " + JSON.stringify(data.details);
        loadDeveloperPanel();
    } catch (err) {
        console.error(err);
        msg.textContent = "❌ Failed to reset storage.";
    }
}

async function clearUploads() {
    if (!confirm(
        "This will permanently delete EVERY uploaded PDF and wipe the entire " +
        "ChromaDB knowledge base. The chatbot will lose all document-based " +
        "answers until documents are re-uploaded. Continue?"
    )) return;

    const msg = document.getElementById("dangerZoneMsg");
    msg.textContent = "Working…";

    try {
        const res = await CampusAuth.adminFetch("/dev/storage/uploads", { method: "DELETE" });
        const data = await res.json();
        msg.textContent = data.message;
        loadDeveloperPanel();
    } catch (err) {
        console.error(err);
        msg.textContent = "❌ Failed to clear uploads.";
    }
}

async function clearLogsCollection() {
    if (!confirm("This will permanently delete all chat logs. Continue?")) return;

    const msg = document.getElementById("dangerZoneMsg");
    msg.textContent = "Working…";

    try {
        const res = await CampusAuth.adminFetch("/dev/storage/logs", { method: "DELETE" });
        const data = await res.json();
        msg.textContent = data.message;
        loadDeveloperPanel();
    } catch (err) {
        console.error(err);
        msg.textContent = "❌ Failed to clear logs.";
    }
}

// ── VECTOR DB MANAGEMENT ─────────────────────────────────────────────
async function loadVectorDB() {

    const body = document.getElementById("vectorDbBody");
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-dim)">Loading…</td></tr>`;

    try {
        const res = await CampusAuth.adminFetch("/dev/vectordb");
        const data = await res.json();

        if (!data.connected) {
            body.innerHTML = `<tr><td colspan="3" style="color:var(--danger)">⚠️ ChromaDB not reachable.</td></tr>`;
            return;
        }

        if (data.collections.length === 0) {
            body.innerHTML = `<tr><td colspan="3" style="color:var(--text-dim)">No collections found.</td></tr>`;
            return;
        }

        body.innerHTML = data.collections.map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.chunkCount ?? "—"}</td>
                <td>
                    <button class="btn-sm danger" onclick="deleteCollection('${c.name}')">🗑 Delete Collection</button>
                </td>
            </tr>
        `).join("");

    } catch (err) {
        console.error(err);
        body.innerHTML = `<tr><td colspan="3" style="color:var(--danger)">Failed to load.</td></tr>`;
    }
}

async function deleteCollection(name) {
    if (!confirm(`Permanently delete the entire "${name}" collection from ChromaDB?`)) return;

    try {
        const res = await CampusAuth.adminFetch(`/dev/vectordb/${encodeURIComponent(name)}`, { method: "DELETE" });
        const data = await res.json();
        alert(data.message || data.error);
        loadVectorDB();
    } catch (err) {
        console.error(err);
        alert("Failed to delete collection.");
    }
}

// ── AI PROVIDER STATUS ───────────────────────────────────────────────
async function loadAiStatus() {

    const el = document.getElementById("aiStatusBody");

    try {
        const res = await CampusAuth.adminFetch("/dev/ai-status");
        const data = await res.json();

        el.innerHTML = `
            <tr><td>Provider</td><td>${data.provider}</td></tr>
            <tr><td>API Key Configured</td><td>${data.apiKeyConfigured ? "✅ Yes" : "❌ No"}</td></tr>
        `;
    } catch (err) {
        console.error(err);
        el.innerHTML = `<tr><td colspan="2" style="color:var(--danger)">Failed to load.</td></tr>`;
    }
}

async function testAiProvider() {

    const resultEl = document.getElementById("aiTestResult");
    resultEl.textContent = "Testing… (this makes one real API call)";

    try {
        const res = await CampusAuth.adminFetch("/dev/ai-status/test", { method: "POST" });
        const data = await res.json();

        resultEl.textContent = data.working
            ? `✅ Working — responded in ${data.latencyMs}ms. Sample reply: "${data.sampleReply}"`
            : `❌ Failed: ${data.error}`;
    } catch (err) {
        console.error(err);
        resultEl.textContent = "❌ Test request failed.";
    }
}

// ── DEVELOPER LOGS / ERROR MONITOR ───────────────────────────────────
async function loadLogs(mode) {

    // mode: "all" (Developer Logs) or "error" (Error Monitor)
    const level = mode === "error" ? "error" : "";
    const bodyId = mode === "error" ? "errorMonitorBody" : "devLogsBody";
    const body = document.getElementById(bodyId);

    body.innerHTML = `<p style="color:var(--text-muted)">Loading…</p>`;

    try {
        const res = await CampusAuth.adminFetch(`/dev/logs${level ? `?level=${level}` : ""}`);
        const data = await res.json();

        if (data.logs.length === 0) {
            body.innerHTML = `<p style="color:var(--text-dim)">No entries yet.</p>`;
            return;
        }

        body.innerHTML = data.logs.map(entry => {
            const color = entry.level === "error"
                ? "var(--danger)"
                : entry.level === "warn"
                    ? "#fbbf24"
                    : "var(--text-muted)";

            const time = new Date(entry.timestamp).toLocaleTimeString();

            return `
                <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8rem;">
                    <span style="color:${color};font-weight:600;">[${entry.level.toUpperCase()}]</span>
                    <span style="color:var(--text-dim)">${time}</span><br>
                    <span style="word-break:break-word;">${escapeHtmlDev(entry.message)}</span>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error(err);
        body.innerHTML = `<p style="color:var(--danger)">Failed to load logs.</p>`;
    }
}

async function clearDevLogs() {
    if (!confirm("Clear all captured logs (including errors)?")) return;

    try {
        await CampusAuth.adminFetch("/dev/logs", { method: "DELETE" });
        loadLogs("all");
        loadLogs("error");
    } catch (err) {
        console.error(err);
        alert("Failed to clear logs.");
    }
}

// ── CACHE MANAGEMENT ─────────────────────────────────────────────────
async function loadCacheStatus() {

    const body = document.getElementById("cacheBody");

    try {
        const res = await CampusAuth.adminFetch("/dev/cache");
        const data = await res.json();
        const c = data.faqCache;

        body.innerHTML = `
            <tr><td>FAQ Cache Status</td><td>${c.cached ? "✅ Cached" : "❌ Empty"}</td></tr>
            <tr><td>Cached Entries</td><td>${c.entryCount}</td></tr>
            <tr><td>Cache Age</td><td>${c.ageSeconds !== null ? `${c.ageSeconds}s` : "—"}</td></tr>
            <tr><td>Cache TTL</td><td>${c.ttlSeconds}s</td></tr>
        `;
    } catch (err) {
        console.error(err);
        body.innerHTML = `<tr><td colspan="2" style="color:var(--danger)">Failed to load.</td></tr>`;
    }
}

async function clearFaqCacheAction() {
    try {
        const res = await CampusAuth.adminFetch("/dev/cache", { method: "DELETE" });
        const data = await res.json();
        alert(data.message);
        loadCacheStatus();
    } catch (err) {
        console.error(err);
        alert("Failed to clear cache.");
    }
}

// ── API TESTER ───────────────────────────────────────────────────────
// A tiny built-in Postman-like tool: pick a method, type a path
// (relative to the API base), optional JSON body, choose which auth
// token to send (or none), and see the raw response.
async function runApiTest() {

    const method = document.getElementById("apiTestMethod").value;
    const pathInput = document.getElementById("apiTestPath").value.trim();
    const bodyInput = document.getElementById("apiTestBody").value.trim();
    const authMode = document.getElementById("apiTestAuth").value;
    const resultEl = document.getElementById("apiTestResult");

    if (!pathInput) {
        resultEl.textContent = "Enter a path first, e.g. /faqs";
        return;
    }

    resultEl.textContent = "Sending…";

    try {

        const headers = { "Content-Type": "application/json" };

        if (authMode === "admin") {
            headers["Authorization"] = `Bearer ${CampusAuth.getAdminToken()}`;
        } else if (authMode === "user") {
            headers["Authorization"] = `Bearer ${CampusAuth.getUserToken()}`;
        }

        const options = { method, headers };

        if (method !== "GET" && bodyInput) {
            options.body = bodyInput;
        }

        const startedAt = Date.now();
        const res = await fetch(`${API}${pathInput}`, options);
        const latencyMs = Date.now() - startedAt;

        let responseText;
        try {
            const json = await res.json();
            responseText = JSON.stringify(json, null, 2);
        } catch {
            responseText = "(non-JSON response)";
        }

        resultEl.textContent =
            `Status: ${res.status} — ${latencyMs}ms\n\n${responseText}`;

    } catch (err) {
        console.error(err);
        resultEl.textContent = `Request failed: ${err.message}`;
    }
}

// Small helper so log messages/filenames can never break the HTML we
// inject (e.g. a message containing < or & characters).
function escapeHtmlDev(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Reuse the same theme toggle behavior as the rest of the app.
const themeToggleBtn = document.getElementById("themeToggle");
if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
        const body = document.body;
        const isDark = body.getAttribute("data-theme") === "dark";
        body.setAttribute("data-theme", isDark ? "light" : "dark");
    });
}