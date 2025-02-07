# VS Code Folder Tree Extension

A Visual Studio Code extension that lets you:

- Generate a pruned folder tree diagram, starting from your workspace root.
- Include only the relevant folders you select in the Explorer (plus any common parent folders).
- Automatically copy that diagram to your clipboard to paste wherever you’d like.

## Features

1. **Right-Click → "Generate Tree"**:
   - Select one or more folders in the Explorer, right-click, and choose **Generate Tree**.
   - The extension will figure out the “lowest common ancestor” if multiple folders are selected.
   - It replaces any unrelated siblings with a `...` placeholder in the ASCII tree.

2. **Configurable Excludes**:
   - Use the VS Code setting `folderTree.exclude` to specify an array of wildcard patterns (e.g. `["node_modules"]` or `["*.log"]`), so they are not included in the generated tree.

3. **One-Click Copy**:
   - After generating the tree, the extension automatically copies it to your clipboard.
   - Simply paste the result wherever needed (documentation, chat messages, etc.).

## Installation

### **1. Clone the repo**
1. **Clone the repo**:
   ```bash
   git clone https://github.com/MariaHendrikx/Copy-FolderTree.git
   cd Copy-FolderTree
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
### **2. Create a VSIX Package**
   If you want to create a `.vsix` file for local installation or distribution:

   1. **Install VSCE (if not already installed)**  
      Run the following command to install Microsoft's VS Code Extension Manager (`vsce`):
      ```bash
      npm install -g vsce
      ```

   2. **Build the Extension**  
      Ensure your extension is properly compiled:
      ```bash
      npm run compile
      ```

   3. **Generate the `.vsix` File**  
      Run:
      ```bash
      vsce package
      ```
      This will generate a `.vsix` file in the project root (e.g., `folder-tree-1.0.0.vsix`).

   4. **Install the `.vsix` File in VS Code**  
      - Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
      - Select `Extensions: Install from VSIX...`.
      - Choose the `.vsix` file.
      - The extension will now be installed.

## Usage

1. Open (or create) a folder in VS Code.
2. Select one or more **folders** in the Explorer panel (not files).
3. Right-click and choose **_Generate Tree_** from the context menu.
4. The extension:
   - Builds the folder structure from the workspace root.
   - Finds the minimal set of folders needed to show the selected folder(s) (including a shared parent if multiple are selected).
   - Replaces unrelated siblings with `...`.
   - Copies the resulting ASCII tree to your clipboard.
5. Paste the tree (`Ctrl+V` / `Cmd+V`) into any editor or chat.

## Extension Settings

- `folderTree.exclude`: An array of wildcard patterns to exclude from the tree.  
  Example:
  ```json
  {
    "folderTree.exclude": ["node_modules", "*.log", "dist*"]
  }
