(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  let editingModalModelId = null;

  function getEl(id) {
    return document.getElementById(id);
  }

  function renderModelListInModal() {
    const container = getEl('modelModalList');
    if (!container) return;
    const models = app.state.models || [];

    if (!models.length) {
      container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--vscode-descriptionForeground);">暂无模型</div>';
      return;
    }

    const escapeHtml = app.utils.escapeHtml;
    const editIcon = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>';
    const deleteIcon = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    container.innerHTML = models.map(m =>
      '<div class="modal-model-item">' +
      '<div class="modal-model-info"><div class="modal-model-name">' + escapeHtml(m.name) + '</div>' +
      '<div class="modal-model-id">' + escapeHtml(m.modelId) + '</div></div>' +
      '<div class="modal-model-actions">' +
      '<button class="modal-icon-btn" type="button" title="编辑" data-action="edit-modal-model" data-id="' + escapeHtml(m.id) + '">' + editIcon + '</button>' +
      '<button class="modal-icon-btn delete" type="button" title="删除" data-action="delete-modal-model" data-id="' + escapeHtml(m.id) + '">' + deleteIcon + '</button>' +
      '</div></div>'
    ).join('');
  }

  function showModelFormInModal() {
    editingModalModelId = null;
    const form = getEl('modelModalForm');
    const list = getEl('modelModalList');
    const saveBtn = getEl('modelModalSaveBtn');
    const addBtn = getEl('modelModalAddBtn');
    if (form) form.style.display = 'block';
    if (list) list.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-block';
    if (addBtn) addBtn.style.display = 'none';
    const name = getEl('modalModelName');
    const apiKey = getEl('modalModelApiKey');
    const baseUrl = getEl('modalModelBaseUrl');
    const modelId = getEl('modalModelId');
    if (name) name.value = '';
    if (apiKey) apiKey.value = '';
    if (baseUrl) baseUrl.value = '';
    if (modelId) modelId.value = '';
    const provider = getEl('modalModelProvider');
    if (provider) provider.value = 'openai';
  }

  function showModelListInModal() {
    const form = getEl('modelModalForm');
    const list = getEl('modelModalList');
    const saveBtn = getEl('modelModalSaveBtn');
    const addBtn = getEl('modelModalAddBtn');
    if (form) form.style.display = 'none';
    if (list) list.style.display = 'block';
    if (saveBtn) saveBtn.style.display = 'none';
    if (addBtn) addBtn.style.display = 'inline-block';
  }

  function editModelInModal(id) {
    const models = app.state.models || [];
    const m = models.find(x => x.id === id);
    if (!m) return;
    editingModalModelId = id;
    const form = getEl('modelModalForm');
    const list = getEl('modelModalList');
    const saveBtn = getEl('modelModalSaveBtn');
    const addBtn = getEl('modelModalAddBtn');
    if (form) form.style.display = 'block';
    if (list) list.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-block';
    if (addBtn) addBtn.style.display = 'none';
    const name = getEl('modalModelName');
    const provider = getEl('modalModelProvider');
    const apiKey = getEl('modalModelApiKey');
    const baseUrl = getEl('modalModelBaseUrl');
    const modelId = getEl('modalModelId');
    if (name) name.value = m.name || '';
    if (provider) provider.value = m.provider || 'openai';
    if (apiKey) apiKey.value = m.apiKey || '';
    if (baseUrl) baseUrl.value = m.baseUrl || '';
    if (modelId) modelId.value = m.modelId || '';
  }

  function saveModelFromModal() {
    const name = getEl('modalModelName');
    const provider = getEl('modalModelProvider');
    const apiKey = getEl('modalModelApiKey');
    const baseUrl = getEl('modalModelBaseUrl');
    const modelId = getEl('modalModelId');
    const model = {
      id: editingModalModelId || Date.now().toString(),
      name: name ? name.value.trim() : '',
      provider: provider ? provider.value : 'openai',
      apiKey: apiKey ? apiKey.value.trim() : '',
      baseUrl: baseUrl ? baseUrl.value.trim() || null : null,
      modelId: modelId ? modelId.value.trim() : '',
      temperature: 0.7,
      maxTokens: 4000,
      maxInputTokens: 128000
    };
    if (!model.name || !model.apiKey || !model.modelId) {
      alert('请填写名称、API Key 和 Model ID');
      return;
    }
    app.postMessage({ type: 'saveModel', model: model });
    renderModelListInModal();
    showModelListInModal();
  }

  function deleteModelFromModal(id) {
    app.postMessage({ type: 'deleteModel', modelId: id });
    renderModelListInModal();
  }

  function openModelConfig() {
    closeSettingsMenu();
    renderModelListInModal();
    const modal = getEl('modelModal');
    if (modal) modal.classList.add('show');
  }

  function closeModelModal() {
    const modal = getEl('modelModal');
    if (modal) modal.classList.remove('show');
    showModelListInModal();
  }

  function closeSettingsMenu() {
    const dropdown = getEl('settingsDropdown');
    if (dropdown) dropdown.classList.remove('show');
  }

  function updateModels(models, selectedModelId) {
    app.state.models = models || [];
    app.state.selectedModelId = selectedModelId || '';
    const modal = getEl('modelModal');
    const modalList = getEl('modelModalList');
    const modalForm = getEl('modelModalForm');
    if (modal && modal.classList.contains('show') && modalList && modalForm && modalForm.style.display !== 'block') {
      renderModelListInModal();
    }
  }

  app.ui.updateModels = updateModels;
  app.ui.openModelConfig = openModelConfig;
  app.ui.closeModelModal = closeModelModal;
  app.ui.showModelFormInModal = showModelFormInModal;
  app.ui.saveModelFromModal = saveModelFromModal;
  app.ui.editModelInModal = editModelInModal;
  app.ui.deleteModelFromModal = deleteModelFromModal;
  app.ui.renderModelListInModal = renderModelListInModal;
})();
