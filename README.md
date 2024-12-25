# FolderTree Extension for Visual Studio Code

FolderTree is a lightweight Visual Studio Code extension that generates a hierarchical tree representation of your folder structure. Perfect for visualizing, documenting, or sharing your project's file organization.

## Features
- **Tree Visualization**: Generates a text-based folder tree using ASCII characters.
- **Exclusion Support**: Customize the folders and files to exclude from the tree generation.
- **Clipboard Integration**: Automatically copies the generated tree to your clipboard.

## Installation
1. Clone this repository.
2. Run `npm install`.
3. Press `F5` in VS Code to debug the extension.

## Configuration
Add exclusions to your `settings.json`:
```json
"folderTree.exclude": ["node_modules", "*.pyc", "__pycache__", "venv", ".git"]
