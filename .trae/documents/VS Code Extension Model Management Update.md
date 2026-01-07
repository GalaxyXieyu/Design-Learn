I will implement the duplicate name check for the VS Code extension, similar to the Chrome extension update.

**Plan:**
1.  **Modify `vscode-extension/media/webview/main.js`**:
    *   In the `saveModel` function, add a validation step to check if a model with the same name already exists in the `models` list.
    *   If a duplicate is found, show an alert "模型名称不能重复" (Model name cannot be repeated) and stop the save process.

This ensures that adding a model is immediate (as it currently is) but prevents duplicates, fulfilling all requirements.