/**
 * ADMIN LOGIN / AUTH
 * ---------------------------------------------------------------------
 * YLSMS has no per-person accounts — there is one shared Admin password
 * (set on the Settings page). Anyone can browse the site read-only
 * (members, attendance, fees, birthdays, reports). Adding, editing or
 * deleting anything requires logging in as Admin first.
 *
 * How it works:
 * - Logging in calls the backend's "adminLogin" action with the typed
 *   password. The backend checks it against the stored Admin password
 *   and, if correct, returns a random session token (never the password
 *   itself). That token is kept in sessionStorage (cleared automatically
 *   when the browser tab is closed) and sent along with every write
 *   request (add/update/delete member, mark attendance, mark fees,
 *   save settings). The backend re-checks the token on every write, so
 *   even someone editing the page's HTML/JS in their browser can't
 *   bypass the login.
 * - In DEMO MODE (no backend connected yet) there's no real server to
 *   check against, so a fixed demo password is used instead — see
 *   AUTH_DEMO_PASSWORD below.
 */

const AUTH_TOKEN_KEY = 'ylsms_admin_token';
const AUTH_DEMO_PASSWORD = 'admin123';

function getAdminToken() {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setAdminToken(token) {
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (e) { /* ignore */ }
}

function clearAdminToken() {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) { /* ignore */ }
}

function isAdmin() {
  return !!getAdminToken();
}

/** Throws on incorrect password. Resolves with nothing on success. */
async function loginAdmin(password) {
  if (CONFIG.DEMO_MODE) {
    if (password === AUTH_DEMO_PASSWORD) {
      setAdminToken('demo-token-' + Date.now());
      return;
    }
    throw new Error('Incorrect password.');
  }
  const token = await Api.adminLogin(password);
  setAdminToken(token);
}

async function logoutAdmin() {
  const token = getAdminToken();
  clearAdminToken();
  if (!CONFIG.DEMO_MODE && token) {
    try { await Api.adminLogout(token); } catch (e) { /* best effort */ }
  }
}

/**
 * Toggles every admin-gated element on the current page to match the
 * current login state. Call this after the layout (navbar/sidebar) has
 * loaded, and again right after a successful login/logout.
 *
 * - ".admin-only"      → hidden unless logged in as Admin
 * - ".guest-only"       → hidden once logged in as Admin
 * - ".admin-editable"   → disabled unless logged in as Admin
 */
function applyAuthUI() {
  const admin = isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('d-none', !admin));
  document.querySelectorAll('.guest-only').forEach(el => el.classList.toggle('d-none', admin));
  document.querySelectorAll('.admin-editable').forEach(el => { el.disabled = !admin; });
  document.querySelectorAll('.js-auth-name').forEach(el => { el.textContent = admin ? 'Admin' : 'Guest'; });
  document.querySelectorAll('.js-auth-role').forEach(el => { el.textContent = admin ? 'Society Manager' : 'View-only access'; });
  document.querySelectorAll('.js-auth-avatar').forEach(el => { el.textContent = admin ? 'A' : 'G'; });
  document.querySelectorAll('.js-auth-login-btn').forEach(el => { el.classList.toggle('d-none', admin); });
  document.querySelectorAll('.js-auth-logout-btn').forEach(el => { el.classList.toggle('d-none', !admin); });
}

/**
 * Wires up every "Admin Login" trigger and the shared login modal that
 * components/navbar.html injects on every page. Also wires logout
 * buttons. Safe to call multiple times.
 */
function wireAuthUI() {
  const modalEl = document.getElementById('adminLoginModal');
  const form = document.getElementById('adminLoginForm');
  const input = document.getElementById('adminLoginPassword');
  const alertBox = document.getElementById('adminLoginAlert');

  document.querySelectorAll('.js-auth-login-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!modalEl) return;
      if (alertBox) alertBox.innerHTML = '';
      if (input) input.value = '';
      const demoHint = document.getElementById('adminLoginDemoHint');
      if (demoHint) demoHint.classList.toggle('d-none', !CONFIG.DEMO_MODE);
      new bootstrap.Modal(modalEl).show();
    });
  });

  document.querySelectorAll('.js-auth-logout-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await logoutAdmin();
      applyAuthUI();
      showToast('Logged out. You are now in view-only mode.', 'info');
      // Re-render the current page's dynamic content (tables, forms,
      // edit controls) so it immediately reflects the guest view.
      window.dispatchEvent(new Event('ylsms:authchanged'));
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('adminLoginSubmit');
      setButtonLoading(btn, true, 'Checking…');
      try {
        await loginAdmin(input.value);
        bootstrap.Modal.getInstance(modalEl).hide();
        applyAuthUI();
        showToast('Logged in as Admin.', 'success');
        window.dispatchEvent(new Event('ylsms:authchanged'));
      } catch (err) {
        if (alertBox) {
          alertBox.innerHTML = `<div class="alert alert-danger alert-dismissible fade show" role="alert">${escapeHtml(err.message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
        }
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }
}
