import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('folderTree.generateTree', async (uri?: vscode.Uri) => {
        let folderPath: string | undefined;

        // If the command is executed from the right-click menu, we get `uri`
        if (uri && uri.fsPath) {
            folderPath = uri.fsPath;
        } else {
            // Get selected folders from the VS Code Explorer
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                folderPath = path.dirname(editor.document.uri.fsPath);
            } else {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage("No workspace folder is open.");
                    return;
                }
                folderPath = workspaceFolders[0].uri.fsPath; // Default to workspace root
            }
        }

        if (!folderPath) {
            vscode.window.showErrorMessage("No folder selected.");
            return;
        }

        // Get exclude patterns from settings
        const excludePatterns = vscode.workspace.getConfiguration('folderTree').get<string[]>('exclude') || [];

        const tree = buildTree(folderPath, excludePatterns);
        const treeString = renderTree(tree);

        // Copy the tree structure to the clipboard
        try {
            await vscode.env.clipboard.writeText(treeString);
            vscode.window.showInformationMessage(`Folder tree copied from: ${folderPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy to clipboard: ${error}`);
            console.error("Clipboard Error:", error);
        }
    });

    context.subscriptions.push(disposable);
}


interface TreeNode {
    name: string;
    children?: TreeNode[];
}

function buildTree(dirPath: string, excludePatterns: string[] = []): TreeNode {
    const stats = fs.statSync(dirPath);
    const item: TreeNode = { name: path.basename(dirPath), children: [] };

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

function renderTree(tree: TreeNode, prefix: string = '', isLast: boolean = true): string {
    const connector = isLast ? '└── ' : '├── ';
    const result = `${prefix}${connector}${tree.name}\n`;

    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    const children = tree.children || [];
    const childLines = children.map((child, index) =>
        renderTree(child, newPrefix, index === children.length - 1)
    );

    return result + childLines.join('');
}

export function deactivate() {}
