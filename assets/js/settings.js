/**
 * SETTINGS PAGE LOGIC
 */

onLayoutReady(initSettingsPage);

async function initSettingsPage() {
  document.getElementById('pageTitle').textContent = 'Settings';
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
  document.getElementById('changePasswordForm').addEventListener('submit', handleChangePasswordSubmit);
  document.getElementById('newYearForm').addEventListener('submit', handleStartNewYearSubmit);
  document.getElementById('btnConfirmStartNewYear').addEventListener('click', confirmStartNewYear);
  document.getElementById('archiveYear').value = new Date().getFullYear();

  const demoHint = document.getElementById('demoPasswordHint');
  if (demoHint) {
    demoHint.textContent = CONFIG.DEMO_MODE
      ? 'Demo mode: password changes here are not saved — connect a real backend first.'
      : 'Choose a password only your club\'s admins know. You\'ll need it again next time you log in.';
  }

  try {
    const settings = await Api.fetchSettings();
    document.getElementById('orgName').value = settings.orgName || '';
    document.getElementById('whatsappLink').value = settings.whatsappLink || '';
    document.getElementById('feeAmount').value = settings.feeAmount || '';
    document.getElementById('systemTheme').value = settings.theme || 'default';
  } catch (err) {
    showAlert(document.getElementById('settingsAlert'), 'Could not load settings: ' + err.message);
  }
}

window.addEventListener('ylsms:authchanged', () => {
  // Nothing to re-render here besides the admin-only/guest-only blocks,
  // which applyAuthUI() already handles.
});

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('passwordAlert'));

  const newPassword = document.getElementById('newAdminPassword').value;
  const confirmPassword = document.getElementById('confirmAdminPassword').value;

  if (newPassword.length < 4) {
    showAlert(document.getElementById('passwordAlert'), 'Password must be at least 4 characters.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showAlert(document.getElementById('passwordAlert'), 'Passwords do not match.');
    return;
  }

  const btn = document.getElementById('btnChangePassword');
  setButtonLoading(btn, true, 'Updating…');
  try {
    await Api.changeAdminPassword(newPassword);
    document.getElementById('changePasswordForm').reset();
    showToast(CONFIG.DEMO_MODE ? 'Demo mode: password not actually changed.' : 'Admin password updated.', 'success');
  } catch (err) {
    showAlert(document.getElementById('passwordAlert'), 'Could not update password: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('settingsAlert'));
  if (!isAdmin()) {
    showAlert(document.getElementById('settingsAlert'), 'Please log in as Admin to save settings.');
    return;
  }

  const data = {
    orgName: document.getElementById('orgName').value.trim(),
    whatsappLink: document.getElementById('whatsappLink').value.trim(),
    feeAmount: document.getElementById('feeAmount').value || '0',
    theme: document.getElementById('systemTheme').value
  };

  if (!data.orgName) {
    showAlert(document.getElementById('settingsAlert'), 'Organization name is required.');
    return;
  }

  const btn = document.getElementById('btnSaveSettings');
  setButtonLoading(btn, true);
  try {
    await Api.saveSettings(data);
    document.body.setAttribute('data-theme', data.theme === 'default' ? '' : data.theme);
    const orgLabel = document.getElementById('navOrgName');
    if (orgLabel) orgLabel.textContent = data.orgName;
    showToast('Settings saved successfully.', 'success');
  } catch (err) {
    showAlert(document.getElementById('settingsAlert'), 'Could not save settings: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

function handleStartNewYearSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('newYearAlert'));
  if (!isAdmin()) {
    showAlert(document.getElementById('newYearAlert'), 'Please log in as Admin to do this.');
    return;
  }

  const year = document.getElementById('archiveYear').value.trim();
  if (!/^\d{4}$/.test(year)) {
    showAlert(document.getElementById('newYearAlert'), 'Please enter a valid 4-digit year.');
    return;
  }

  document.getElementById('confirmAttSheetName').textContent = `Attendance ${year}`;
  document.getElementById('confirmFeeSheetName').textContent = `Fees ${year}`;
  new bootstrap.Modal(document.getElementById('newYearConfirmModal')).show();
}

async function confirmStartNewYear() {
  const year = document.getElementById('archiveYear').value.trim();
  const btn = document.getElementById('btnConfirmStartNewYear');
  setButtonLoading(btn, true, 'Archiving…');
  try {
    await Api.startNewYear(year);
    bootstrap.Modal.getInstance(document.getElementById('newYearConfirmModal')).hide();
    showToast(
      CONFIG.DEMO_MODE
        ? 'Demo mode: nothing was actually archived.'
        : `Archived as "Attendance ${year}" / "Fees ${year}" — Jan-Dec is now blank for the new year.`,
      'success'
    );
  } catch (err) {
    showAlert(document.getElementById('newYearAlert'), 'Could not start new year: ' + err.message);
    bootstrap.Modal.getInstance(document.getElementById('newYearConfirmModal')).hide();
  } finally {
    setButtonLoading(btn, false);
  }
}
