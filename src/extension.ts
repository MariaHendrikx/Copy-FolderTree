import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // Register the command so it can be called from the Explorer context menu.
    // Note that VS Code will invoke this command with the selected folder(s).
    const disposable = vscode.commands.registerCommand(
        'folderTree.generateTree',
        async (firstSelection: vscode.Uri | undefined, allSelections: vscode.Uri[] | undefined) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("No workspace folder is open.");
                return;
            }

            // If the command is triggered via the Explorer context menu, VS Code
            // often passes (firstSelection, allSelections[]) or just a single Uri.
            // Normalize to an array of Uris (only folders).
            let selectedUris: vscode.Uri[] = [];
            if (Array.isArray(allSelections) && allSelections.length > 0) {
                selectedUris = allSelections;
            } else if (firstSelection) {
                selectedUris = [ firstSelection ];
            }

            // If nothing is selected, fallback to entire workspace root or bail out
            if (selectedUris.length === 0) {
                vscode.window.showErrorMessage("No folder(s) selected.");
                return;
            }

            const workspacePath = workspaceFolders[0].uri.fsPath;

            // Get exclude patterns from settings
            const excludePatterns = vscode.workspace
                .getConfiguration('folderTree')
                .get<string[]>('exclude') || [];

            // Build an internal tree for the entire workspace
            const fullTree = buildTree(workspacePath, excludePatterns);

            // Convert selections to absolute folder paths (filter out files if needed)
            // Only keep folders that are inside the workspace root
            const folderSelections = selectedUris
                .map(uri => uri.fsPath)
                .filter(fsPath => fs.lstatSync(fsPath).isDirectory())
                .filter(fsPath => !path.relative(workspacePath, fsPath).startsWith('..'));

            // If user selected valid folders, prune the big tree to show only
            // the path from root to each selected folder, plus children of that folder,
            // and "..." for unrelated siblings.
            const prunedTree = pruneTreeForSelection(fullTree, folderSelections);

            // Render and copy to clipboard
            const treeString = renderTree(prunedTree);
            await vscode.env.clipboard.writeText(treeString);
            vscode.window.showInformationMessage('Pruned folder tree copied to clipboard!');
        }
    );

    context.subscriptions.push(disposable);
}

interface TreeNode {
    name: string;
    fullPath: string;
    children?: TreeNode[];
}

function buildTree(dirPath: string, excludePatterns: string[] = []): TreeNode {
    const stats = fs.statSync(dirPath);
    const node: TreeNode = {
        name: path.basename(dirPath) || dirPath, 
        fullPath: dirPath,
        children: []
    };

    if (stats.isDirectory()) {
        const entries = fs.readdirSync(dirPath).filter(entry => {
            const fullEntryPath = path.join(dirPath, entry);

            // Check against exclude patterns
            const isExcluded = excludePatterns.some(pattern => {
                // Very naive wildcard check; you can enhance as needed
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(entry) || regex.test(fullEntryPath);
            });
            return !isExcluded;
        });

        node.children = entries.map(entry =>
            buildTree(path.join(dirPath, entry), excludePatterns)
        );
    }

    return node;
}

/**
 * Given the full, unpruned workspace tree and a list of selected folder paths,
 * return a pruned tree that:
 * - Always includes the root node
 * - Includes only the path(s) down to the selected folder(s)
 * - Includes the children of the selected folder(s)
 * - Replaces non-relevant siblings with a single TreeNode named "..."
 *
 * This function mutates a copy of the original tree so as not to alter the original.
 */
function pruneTreeForSelection(root: TreeNode, selectedFolderPaths: string[]): TreeNode {
    // Make a deep clone so we don't mutate the original
    const cloned = deepCloneTree(root);

    // We only want to prune *beneath* the workspace root. The root is always shown.
    // Recursively prune children.
    if (cloned.children) {
        cloned.children = pruneChildren(cloned.children, selectedFolderPaths);
    }
    return cloned;
}

/**
 * Recursively prune child nodes so that we keep only:
 * - The path(s) leading to any selected folder,
 * - The children of any selected folder itself,
 * - "..." placeholders for siblings that are not on the path or are not selected.
 */
function pruneChildren(nodes: TreeNode[], selectedFolderPaths: string[]): TreeNode[] {
    // For each directory among siblings, see if it is "on the path" or "descendant" of a selected folder.
    // If it is not relevant at all, we drop it; if it partially conflicts, we replace it with "..."
    // but keep exactly one "..." for all such siblings in that group. 
    //
    // A simpler approach is to check each node:
    //   1) If the node is an ancestor or descendant of a selected folder, we keep recursing.
    //   2) Otherwise, we remove it entirely.
    // But the user wants to see "..." for the omitted siblings. We can do:
    //   - Group children into relevant vs. irrelevant
    //   - Keep the relevant children as-is,
    //   - Insert one "..." node if at least one child is irrelevant.

    const relevant: TreeNode[] = [];
    let hadIrrelevant = false;

    for (const node of nodes) {
        if (isNodeRelevant(node, selectedFolderPaths)) {
            // This node is relevant; keep it, but prune its children if any
            if (node.children && node.children.length > 0) {
                node.children = pruneChildren(node.children, selectedFolderPaths);
            }
            relevant.push(node);
        } else {
            // Not relevant
            hadIrrelevant = true;
        }
    }

    // If there's at least one irrelevant sibling, add a placeholder
    if (hadIrrelevant) {
        relevant.push({
            name: '...',
            fullPath: '',
            children: []
        });
    }

    return relevant;
}

/**
 * A node is relevant if:
 * - It is itself on the path to any selected folder (i.e. ancestor of a selected folder),
 * - Or it is a descendant of a selected folder (the user wants all children of the selected folder).
 * - Or it is exactly the selected folder.
 */
function isNodeRelevant(node: TreeNode, selectedFolders: string[]): boolean {
    return selectedFolders.some(folderPath => {
        // If node is an ancestor or the same as the folderPath
        const isAncestor = isAncestorOrSelf(node.fullPath, folderPath);
        // If node is a descendant or the same as folderPath
        const isDescendant = isAncestorOrSelf(folderPath, node.fullPath);

        // We keep the node if it is on the path from root -> folder or in the sub-tree of folder
        return isAncestor || isDescendant;
    });
}

/**
 * Returns true if 'possibleAncestor' is an ancestor (or the same) of 'possibleDescendant'.
 * This checks the relative path to see if it does not lead out (i.e. '../').
 */
function isAncestorOrSelf(possibleAncestor: string, possibleDescendant: string): boolean {
    const rel = path.relative(possibleAncestor, possibleDescendant);
    // If it doesn't start with '..', then possibleAncestor is indeed an ancestor or is the same
    return !rel.startsWith('..');
}

function deepCloneTree(node: TreeNode): TreeNode {
    return {
        name: node.name,
        fullPath: node.fullPath,
        children: node.children
            ? node.children.map(child => deepCloneTree(child))
            : []
    };
}

function renderTree(
    tree: TreeNode,
    prefix: string = '',
    isLast: boolean = true
): string {
    const connector = isLast ? '└── ' : '├── ';
    const line = `${prefix}${connector}${tree.name}\n`;

    if (!tree.children || tree.children.length === 0) {
        return line;
    }

    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    const childLines = tree.children.map((child, index) => {
        const last = index === tree.children!.length - 1;
        return renderTree(child, newPrefix, last);
    });

    return line + childLines.join('');
}

export function deactivate() {}
