# Developer Guide: VS Code Folder Tree Extension

## Requirements

- **Node.js** (version 14+ recommended)
- **npm** or **yarn**
- **VS Code** installed locally

## Project Setup

1. **Clone the repo**:
   ```bash
   git clone https://github.com/MariaHendrikx/Copy-FolderTree.git
   cd Copy-FolderTree
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn
   ```

## Running the Extension Locally

1. **Open the folder** in VS Code:
   - `File` → `Open Folder...`
2. **Compile the extension**:
   ```bash
   npm run compile
   ```
   or
   ```bash
   yarn compile
   ```
3. **Debug the Extension**:
   - Open the **Run and Debug** panel in VS Code (`Ctrl+Shift+D` / `Cmd+Shift+D`).
   - Select the **Launch Extension** configuration.
   - Press **F5** to start a new Extension Development Host.
   - In the new VS Code window, open or create a test folder.
   - Right-click in the Explorer and choose **Generate Tree** to test the extension.

## Testing

If you have tests, run them with:
```bash
npm test
```
or
```bash
yarn test
```