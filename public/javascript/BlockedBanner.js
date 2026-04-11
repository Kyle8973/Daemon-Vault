// public/javascript/BlockedBanner.js
// B

let globalBlockedUntil = null;

// --- 1. THE WATCHER (Runs every second) ---
setInterval(() => {
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('regBtn');
    const errorBox = document.getElementById('error-msg');

    if (globalBlockedUntil) {
        const now = Date.now();

        if (now >= globalBlockedUntil) {
            // --- THE UNBLOCK MOMENT ---
            globalBlockedUntil = null;

            // 1. Reset Buttons
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
            regBtn.style.display = 'block';
            regBtn.disabled = false;
            regBtn.innerText = "Register";

            // 2. TURN RED WARNING INTO GREEN SUCCESS MESSAGE
            errorBox.style.display = 'block';
            errorBox.style.backgroundColor = '#d4edda'; // Light green
            errorBox.style.color = '#155724';           // Dark green
            errorBox.style.borderColor = '#c3e6cb';     // Green border
            errorBox.innerText = "Rate Limit Block Expired - You Can Login Now";

        } else {
            // Enforcement: Ensure buttons stay locked
            loginBtn.disabled = true;
            loginBtn.innerText = "Blocked";
            regBtn.style.display = 'none';

            // Ensure it looks like an error while blocked
            errorBox.style.backgroundColor = '#f8d7da'; // Light red
            errorBox.style.color = '#721c24';           // Dark red
            errorBox.style.borderColor = '#f5c6cb';     // Red border
        }
    }
}, 1000);

// --- 2. STATUS CHECK ON LOAD ---
async function checkStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.blocked && data.blockedUntil) {
            globalBlockedUntil = data.blockedUntil;
        }
    } catch (e) { console.error("Status check failed"); }
}

async function auth(url) {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const errorBox = document.getElementById('error-msg');
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('regBtn');

    // Reset styles to default Red when a new attempt is made
    errorBox.style.display = 'none';
    errorBox.style.backgroundColor = '#f8d7da';
    errorBox.style.color = '#721c24';
    errorBox.style.borderColor = '#f5c6cb';

    if (!globalBlockedUntil) {
        loginBtn.disabled = true;
        regBtn.disabled = true;
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });

        const data = await res.json();

        if (res.ok) {
            window.location.href = '/';
        } else {
            errorBox.innerText = data.error || "Login Failed";
            errorBox.style.display = 'block';

            if (res.status === 429 && data.blockedUntil) {
                globalBlockedUntil = data.blockedUntil;
            }
        }
    } catch (err) {
        errorBox.innerText = "Connection Error";
        errorBox.style.display = 'block';
    } finally {
        if (!globalBlockedUntil) {
            loginBtn.disabled = false;
            regBtn.disabled = false;
        }
    }
}

checkStatus();