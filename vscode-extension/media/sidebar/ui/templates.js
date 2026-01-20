(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  let editingTemplateId = null;
  let editingTemplateIsSystem = false;

  function getEl(id) {
    return document.getElementById(id);
  }

  function normalizeTemplate(template) {
    if (!template || typeof template !== 'object') return null;
    const metadata = template.metadata && typeof template.metadata === 'object' ? template.metadata : null;
    const isSystem = template.system === true || metadata?.system === true;
    return {
      id: String(template.id || ''),
      name: typeof template.name === 'string' ? template.name : '',
      prompt: typeof template.prompt === 'string' ? template.prompt : '',
      isDefault: template.isDefault === true || template.active === true,
      system: isSystem,
      createdAt: template.createdAt || null,
    };
  }

  function renderTemplateSelect() {
    const select = getEl('promptTemplateSelect');
    if (!select) return;
    const items = (app.state.promptTemplates || []).map(normalizeTemplate).filter(Boolean);
    if (items.length && !items.some((item) => item.isDefault)) {
      const systemItem = items.find((item) => item.system);
      if (systemItem) systemItem.isDefault = true;
    }
    const escapeHtml = app.utils.escapeHtml;
    const defaultItem = items.find((item) => item.isDefault) || items.find((item) => item.system);
    const defaultLabel = defaultItem
      ? `默认模板（${defaultItem.name ? escapeHtml(defaultItem.name) : '系统'}）`
      : '默认模板';
    if (!items.length) {
      select.innerHTML = `<option value=\"\">${defaultLabel}</option>`;
      select.value = '';
      return;
    }
    const options = [
      `<option value=\"\">${defaultLabel}</option>`,
      ...items.map((item) => {
        let suffix = '';
        if (item.system && item.isDefault) suffix = '（系统默认）';
        else if (item.system) suffix = '（系统）';
        else if (item.isDefault) suffix = '（默认）';
        const label = item.name ? `${item.name}${suffix}` : `未命名模板${suffix}`;
        return `<option value=\"${escapeHtml(item.id)}\">${escapeHtml(label)}</option>`;
      })
    ];
    select.innerHTML = options.join('');
    const rawSelected = app.state.selectedPromptTemplateId;
    let nextSelected = typeof rawSelected === 'string' ? rawSelected : '';
    if (nextSelected && !items.find(t => t.id === nextSelected)) {
      nextSelected = '';
    }
    if (!nextSelected && rawSelected === undefined) {
      const defaultItem = items.find(t => t.isDefault);
      nextSelected = defaultItem ? defaultItem.id : '';
    }
    app.state.selectedPromptTemplateId = nextSelected;
    select.value = nextSelected;
  }

  function updatePromptTemplates(templates, selectedId) {
    app.state.promptTemplates = Array.isArray(templates) ? templates : [];
    if (selectedId !== undefined) {
      app.state.selectedPromptTemplateId = selectedId || '';
    }
    renderTemplateSelect();
  }

  function handleTemplateSelectChange() {
    const select = getEl('promptTemplateSelect');
    if (!select) return;
    const value = select.value || '';
    app.state.selectedPromptTemplateId = value;
    app.postMessage({ type: 'selectPromptTemplate', templateId: value || null });
  }

  function openTemplateModal(template) {
    const modal = getEl('templateModal');
    const title = getEl('templateModalTitle');
    const nameInput = getEl('templateModalName');
    const promptInput = getEl('templateModalPrompt');
    const defaultInput = getEl('templateModalDefault');
    const deleteBtn = getEl('templateModalDelete');
    if (!modal || !title || !nameInput || !promptInput || !defaultInput) return;
    if (template) {
      editingTemplateId = template.id;
      editingTemplateIsSystem = template.system === true;
      title.textContent = '编辑提示词模板';
      nameInput.value = template.name || '';
      promptInput.value = template.prompt || '';
      defaultInput.checked = !!template.isDefault;
      if (deleteBtn) {
        deleteBtn.style.display = editingTemplateIsSystem ? 'none' : 'inline-flex';
      }
    } else {
      editingTemplateId = null;
      editingTemplateIsSystem = false;
      title.textContent = '新增提示词模板';
      nameInput.value = '';
      promptInput.value = '';
      defaultInput.checked = false;
      if (deleteBtn) {
        deleteBtn.style.display = 'none';
      }
    }
    modal.classList.add('show');
  }

  function closeTemplateModal() {
    const modal = getEl('templateModal');
    if (modal) modal.classList.remove('show');
  }

  function handleOpenEditor() {
    const items = (app.state.promptTemplates || []).map(normalizeTemplate).filter(Boolean);
    const selectedId = app.state.selectedPromptTemplateId || '';
    const current = items.find(t => t.id === selectedId) || items.find(t => t.isDefault);
    if (!current) {
      openTemplateModal(null);
      return;
    }
    openTemplateModal(current);
  }

  function handleCreateTemplate() {
    openTemplateModal(null);
  }

  function saveTemplateModal() {
    const nameInput = getEl('templateModalName');
    const promptInput = getEl('templateModalPrompt');
    const defaultInput = getEl('templateModalDefault');
    if (!nameInput || !promptInput || !defaultInput) return;
    const name = nameInput.value.trim();
    const prompt = promptInput.value.trim();
    if (!name || !prompt) {
      alert('请填写模板名称和提示词内容');
      return;
    }
    const template = {
      id: editingTemplateId || Date.now().toString(),
      name,
      prompt,
      active: defaultInput.checked,
      isUpdate: !!editingTemplateId,
      createdAt: editingTemplateId ? undefined : new Date().toISOString(),
    };
    if (!editingTemplateId) {
      app.state.selectedPromptTemplateId = template.id;
      app.postMessage({ type: 'selectPromptTemplate', templateId: template.id });
    }
    app.postMessage({ type: 'savePromptTemplate', template });
    closeTemplateModal();
  }

  function deleteTemplateModal() {
    if (!editingTemplateId || editingTemplateIsSystem) return;
    if (!confirm('确定要删除这个模板吗?')) return;
    if (app.state.selectedPromptTemplateId === editingTemplateId) {
      app.state.selectedPromptTemplateId = '';
      app.postMessage({ type: 'selectPromptTemplate', templateId: null });
    }
    app.postMessage({ type: 'deletePromptTemplate', templateId: editingTemplateId });
    closeTemplateModal();
  }

  app.ui.updatePromptTemplates = updatePromptTemplates;
  app.ui.handleTemplateSelectChange = handleTemplateSelectChange;
  app.ui.openTemplateEditor = handleOpenEditor;
  app.ui.openTemplateModal = openTemplateModal;
  app.ui.closeTemplateModal = closeTemplateModal;
  app.ui.saveTemplateModal = saveTemplateModal;
  app.ui.deleteTemplateModal = deleteTemplateModal;
  app.ui.createTemplate = handleCreateTemplate;
})();
