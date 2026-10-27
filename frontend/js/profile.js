const PROFILE_FIELDS = [
  { key: 'name', label: 'Full name', type: 'text', required: true, autocomplete: 'name' },
  { key: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' },
  { key: 'rollNumber', label: 'Roll number', type: 'text' },
  { key: 'department', label: 'Branch / Department', type: 'text' },
  { key: 'year', label: 'Current year', type: 'number', min: 1, max: 5 },
  { key: 'semester', label: 'Semester', type: 'number', min: 1, max: 10 },
];

let profileUser = null;
let editingProfileKey = null;
const profileFields = document.getElementById('profileFields');
const profileNotice = document.getElementById('profileNotice');

function setProfileNotice(message, kind = 'info') {
  profileNotice.textContent = message;
  profileNotice.className = `profile-notice ${kind}`;
  profileNotice.hidden = !message;
}

function fieldValue(field) {
  const value = profileUser?.[field.key];
  if (value === undefined || value === null || value === '') return 'Not added';
  if (field.key === 'year') return `Year ${value}`;
  if (field.key === 'semester') return `Semester ${value}`;
  return String(value);
}

function renderProfileFields() {
  profileFields.replaceChildren();
  for (const field of PROFILE_FIELDS) {
    const row = document.createElement('div');
    row.className = 'profile-field-row';
    row.dataset.field = field.key;

    const content = document.createElement('div');
    content.className = 'profile-field-content';
    const label = document.createElement('span');
    label.className = 'profile-field-label';
    label.textContent = field.label;
    const value = document.createElement('span');
    value.className = 'profile-field-value';
    value.textContent = fieldValue(field);
    content.append(label, value);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'profile-edit-button';
    action.setAttribute('aria-label', `Edit ${field.label}`);
    action.title = `Edit ${field.label}`;
    action.textContent = '✎';
    action.addEventListener('click', () => beginFieldEdit(field));
    row.append(content, action);
    profileFields.append(row);
  }
}

function beginFieldEdit(field) {
  if (editingProfileKey) return;
  editingProfileKey = field.key;
  const row = profileFields.querySelector(`[data-field="${field.key}"]`);
  const value = row.querySelector('.profile-field-value');
  const action = row.querySelector('.profile-edit-button');
  const input = document.createElement('input');
  input.className = 'profile-inline-input';
  input.type = field.type;
  input.value = profileUser[field.key] ?? '';
  input.required = Boolean(field.required);
  if (field.autocomplete) input.autocomplete = field.autocomplete;
  if (field.min) input.min = field.min;
  if (field.max) input.max = field.max;
  input.setAttribute('aria-label', field.label);
  value.replaceWith(input);

  action.hidden = true;
  const controls = document.createElement('div');
  controls.className = 'profile-inline-actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'profile-save-icon';
  save.title = 'Save';
  save.setAttribute('aria-label', `Save ${field.label}`);
  save.textContent = '✓';
  save.addEventListener('click', () => saveField(field, input));
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'profile-cancel-icon';
  cancel.title = 'Cancel';
  cancel.setAttribute('aria-label', 'Cancel edit');
  cancel.textContent = '×';
  cancel.addEventListener('click', cancelFieldEdit);
  controls.append(save, cancel);
  row.append(controls);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') saveField(field, input);
    if (event.key === 'Escape') cancelFieldEdit();
  });
  input.focus();
  if (field.type !== 'number') input.select();
}

async function saveField(field, input) {
  if (!input.reportValidity()) return;
  const value = field.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value.trim();
  if (field.required && !value) {
    setProfileNotice(`${field.label} is required.`, 'error');
    input.focus();
    return;
  }
  try {
    const response = await CampusAuth.userFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ [field.key]: value }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Could not update profile.');
    profileUser = data.user;
    CampusAuth.saveUserAuth(CampusAuth.getUserToken(), profileUser);
    editingProfileKey = null;
    renderProfileFields();
    renderProfileIdentity();
    setProfileNotice(`${field.label} updated.`, 'success');
  } catch (error) {
    setProfileNotice(error.message || 'Could not update profile. Please try again.', 'error');
  }
}

function cancelFieldEdit() {
  editingProfileKey = null;
  renderProfileFields();
}

function renderProfileIdentity() {
  document.getElementById('profileHeading').textContent = profileUser.name || 'Your profile';
  document.getElementById('profileAvatar').textContent = (profileUser.name || profileUser.email || 'U').trim().charAt(0).toUpperCase();
}

async function loadProfile() {
  if (!CampusAuth.requireUserLogin('auth/login.html')) return;
  document.body.dataset.theme = localStorage.getItem('theme') || 'dark';
  try {
    const response = await CampusAuth.userFetch('/auth/me');
    const data = await response.json();
    if (!response.ok || !data.user) throw new Error(data.message || 'Could not load your profile.');
    profileUser = data.user;
    CampusAuth.saveUserAuth(CampusAuth.getUserToken(), profileUser);
    renderProfileIdentity();
    renderProfileFields();
  } catch (error) {
    setProfileNotice(error.message || 'Could not load your profile.', 'error');
  }
}

document.getElementById('passwordToggle').addEventListener('click', () => {
  const form = document.getElementById('passwordForm');
  const opening = form.hidden;
  form.hidden = !opening;
  document.getElementById('passwordToggle').setAttribute('aria-expanded', String(opening));
  if (opening) document.getElementById('currentPassword').focus();
});

document.getElementById('passwordCancel').addEventListener('click', () => {
  document.getElementById('passwordForm').reset();
  document.getElementById('passwordForm').hidden = true;
  document.getElementById('passwordToggle').setAttribute('aria-expanded', 'false');
});

document.getElementById('passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (newPassword !== confirmPassword) {
    setProfileNotice('New passwords do not match.', 'error');
    return;
  }
  try {
    const response = await CampusAuth.userFetch('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Could not change password.');
    event.target.reset();
    event.target.hidden = true;
    document.getElementById('passwordToggle').setAttribute('aria-expanded', 'false');
    setProfileNotice('Password updated successfully.', 'success');
  } catch (error) {
    setProfileNotice(error.message || 'Could not change password.', 'error');
  }
});

document.getElementById('logoutButton').addEventListener('click', () => {
  CampusAuth.clearUserAuth();
  window.location.href = 'index.html';
});

loadProfile();
