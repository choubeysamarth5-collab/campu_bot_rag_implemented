(() => {
  let activeDialog = null;

  function closeDialog(result = false) {
    if (!activeDialog) return;
    const current = activeDialog;
    activeDialog = null;
    current.overlay.remove();
    current.resolve(result);
    current.previousFocus?.focus?.();
  }

  function showDialog(message, isConfirm) {
    if (activeDialog) closeDialog(false);

    const overlay = document.createElement('div');
    overlay.className = 'web-ui-overlay';
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeDialog(false);
    });
    const panel = document.createElement('section');
    panel.className = 'web-ui-dialog';
    panel.setAttribute('role', isConfirm ? 'dialog' : 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2');
    heading.textContent = isConfirm ? 'Please confirm' : 'Notice';
    const text = document.createElement('p');
    text.textContent = String(message ?? '');
    const actions = document.createElement('div');
    actions.className = 'web-ui-dialog-actions';
    let resolveResult;
    const result = new Promise(resolve => { resolveResult = resolve; });
    const makeButton = (label, value, primary) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (primary) button.dataset.primary = 'true';
      button.addEventListener('click', () => closeDialog(value));
      actions.appendChild(button);
      return button;
    };
    if (isConfirm) makeButton('Cancel', false, false);
    const primary = makeButton(isConfirm ? 'Confirm' : 'OK', isConfirm, true);
    panel.append(heading, text, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    activeDialog = { overlay, resolve: resolveResult, previousFocus: document.activeElement };
    primary.focus();
    return result;
  }

  window.alert = message => { showDialog(message, false); };
  window.confirm = message => showDialog(message, true);

  function enhanceSelect(select) {
    if (select.dataset.webSelectEnhanced === 'true') return;
    select.dataset.webSelectEnhanced = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'web-select web-native-select';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const id = select.id || `webSelect${Math.random().toString(36).slice(2)}`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = `${select.className} web-select-trigger`;
    trigger.style.cssText = select.style.cssText;
    trigger.id = `${id}WebTrigger`;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}WebOptions`);
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.id || 'Choose an option');
    const label = document.createElement('span');
    const chevron = document.createElement('span');
    chevron.className = 'web-select-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '⌄';
    trigger.append(label, chevron);

    const options = document.createElement('div');
    options.className = 'web-select-options';
    options.id = `${id}WebOptions`;
    options.setAttribute('role', 'listbox');
    options.setAttribute('aria-label', select.getAttribute('aria-label') || select.id || 'Options');
    options.hidden = true;

    const optionButtons = [...select.options].map(nativeOption => {
      const option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'option');
      option.textContent = nativeOption.textContent.trim();
      option.disabled = nativeOption.disabled;
      option.addEventListener('click', () => {
        select.value = nativeOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeMenu();
        syncValue();
        trigger.focus();
      });
      options.appendChild(option);
      return option;
    });

    function syncValue() {
      const selected = [...select.options].find(option => option.value === select.value) || select.options[0];
      label.textContent = selected?.textContent.trim() || 'Choose an option';
      optionButtons.forEach((option, index) => {
        const isSelected = select.options[index] === selected;
        option.setAttribute('aria-selected', String(isSelected));
        option.tabIndex = isSelected ? 0 : -1;
      });
    }
    function closeMenu() {
      options.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      wrapper.classList.remove('is-open');
    }
    trigger.addEventListener('click', () => {
      const opening = options.hidden;
      options.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
      wrapper.classList.toggle('is-open', opening);
      if (opening) options.querySelector('[aria-selected="true"]:not(:disabled)')?.focus();
    });
    select.addEventListener('change', syncValue);
    wrapper.addEventListener('keydown', event => {
      if (event.key === 'Escape') { closeMenu(); trigger.focus(); }
    });
    wrapper.addEventListener('focusout', event => {
      if (!wrapper.contains(event.relatedTarget)) closeMenu();
    });
    wrapper.insertBefore(trigger, select);
    wrapper.appendChild(options);
    syncValue();
  }

  function enhanceSelects() {
    document.querySelectorAll('select').forEach(enhanceSelect);
  }
  function enhanceFileInputs() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.dataset.webFileEnhanced === 'true' || input.style.display === 'none') return;
      input.dataset.webFileEnhanced = 'true';
      input.classList.add('web-native-file-input');
      const picker = document.createElement('div');
      picker.className = 'web-file-picker';
      const choose = document.createElement('button');
      choose.type = 'button';
      choose.className = 'web-file-picker-button';
      choose.textContent = 'Choose file';
      choose.addEventListener('click', () => input.click());
      const filename = document.createElement('span');
      filename.className = 'web-file-picker-name';
      filename.textContent = input.multiple ? 'Drop files here or choose files' : 'Drop a file here or choose one';
      picker.append(choose, filename);
      input.insertAdjacentElement('afterend', picker);

      const showFiles = files => {
        filename.textContent = files.length ? [...files].map(file => file.name).join(', ') : (input.multiple ? 'Drop files here or choose files' : 'Drop a file here or choose one');
      };
      input.refreshWebFilePicker = () => showFiles(input.files || []);
      input.addEventListener('change', () => showFiles(input.files));
      picker.addEventListener('dragover', event => { event.preventDefault(); picker.classList.add('is-dragging'); });
      picker.addEventListener('dragleave', event => { if (!picker.contains(event.relatedTarget)) picker.classList.remove('is-dragging'); });
      picker.addEventListener('drop', event => {
        event.preventDefault();
        picker.classList.remove('is-dragging');
        const transfer = new DataTransfer();
        [...event.dataTransfer.files].forEach(file => transfer.items.add(file));
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('.web-native-select')) return;
    document.querySelectorAll('.web-native-select').forEach(wrapper => {
      const menu = wrapper.querySelector('.web-select-options');
      const button = wrapper.querySelector('.web-select-trigger');
      if (menu && button) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); wrapper.classList.remove('is-open'); }
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeDialog) closeDialog(false);
  });
  const enhancePageControls = () => { enhanceSelects(); enhanceFileInputs(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhancePageControls, { once: true });
  else enhancePageControls();
  new MutationObserver(enhancePageControls).observe(document.documentElement, { childList: true, subtree: true });
})();
