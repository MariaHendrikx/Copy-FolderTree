"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
    const disposable = vscode.commands.registerCommand('folderTree.generateTree', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace folder is open.");
            return;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        // Get exclude patterns from settings
        const excludePatterns = vscode.workspace.getConfiguration('folderTree').get('exclude') || [];
        const tree = buildTree(workspacePath, excludePatterns);
        const treeString = renderTree(tree);
        // Open the tree in a new editor for easy copying
        const doc = await vscode.workspace.openTextDocument({
            content: treeString,
            language: 'plaintext',
        });
        await vscode.window.showTextDocument(doc);
        // Copy the tree structure to the clipboard
        await vscode.env.clipboard.writeText(treeString);
        vscode.window.showInformationMessage('Folder tree copied to clipboard! Paste it anywhere.');
    });
    context.subscriptions.push(disposable);
}
function buildTree(dirPath, excludePatterns = []) {
    const stats = fs.statSync(dirPath);
    const item = { name: path.basename(dirPath), children: [] };
    if (stats.isDirectory()) {
        const entries = fs.readdirSync(dirPath).filter(entry => {
            const fullPath = path.join(dirPath, entry);
            return !excludePatterns.some(pattern => {
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(entry) || regex.test(fullPath);
            });
        });
        item.children = entries.map(entry => buildTree(path.join(dirPath, entry), excludePatterns));
    }
    return item;
}
function renderTree(tree, prefix = '', isLast = true) {
    const connector = isLast ? '└── ' : '├── ';
    const result = `${prefix}${connector}${tree.name}\n`;
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    const children = tree.children || [];
    const childLines = children.map((child, index) => renderTree(child, newPrefix, index === children.length - 1));
    return result + childLines.join('');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map