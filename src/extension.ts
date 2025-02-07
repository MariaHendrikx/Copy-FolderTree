import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'folderTree.generateTree',
        async (firstSelection: vscode.Uri | undefined, allSelections: vscode.Uri[] | undefined) => {

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder is open.');
                return;
            }

            // Normalize the selected URIs.
            let selectedUris: vscode.Uri[] = [];
            if (Array.isArray(allSelections) && allSelections.length > 0) {
                selectedUris = allSelections;
            } else if (firstSelection) {
                selectedUris = [ firstSelection ];
            }

            if (selectedUris.length === 0) {
                vscode.window.showErrorMessage('No folder(s) selected.');
                return;
            }

            const workspacePath = workspaceFolders[0].uri.fsPath;

            // Get exclude patterns from settings
            const excludePatterns = vscode.workspace.getConfiguration('folderTree')
                                    .get<string[]>('exclude') || [];

            // Build the *entire* tree of the workspace
            const fullTree = buildTree(workspacePath, excludePatterns);

            // Filter only valid directories within the workspace
            const folderSelections = selectedUris
                .map(uri => uri.fsPath)
                .filter(fsPath => {
                    if (!fs.existsSync(fsPath)) return false;
                    if (!fs.lstatSync(fsPath).isDirectory()) return false;
                    // Must be inside the workspace root
                    return !path.relative(workspacePath, fsPath).startsWith('..');
                });

            if (folderSelections.length === 0) {
                vscode.window.showErrorMessage('No valid folder selections.');
                return;
            }

            // Build a pruned tree that shows only:
            //  - The minimal parent node if multiple folders share it
            //  - The selected folders themselves
            //  - The children of each selected folder
            //  - "..." placeholders for omitted siblings
            const prunedTree = buildPrunedTree(fullTree, folderSelections);

            // Render the pruned tree and copy to clipboard
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

/**
 * Recursively build the full tree from a folder path, applying exclude filters.
 */
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

            // Very naive wildcard => RegExp approach; customize as needed
            const isExcluded = excludePatterns.some(pattern => {
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
 * Given the full workspace tree and the user-selected folder paths,
 * produce a pruned tree that:
 *   - Shows parents only if there is a common parent for multiple selections.
 *   - Shows the selected folder(s) themselves plus children.
 *   - Replaces any omitted siblings with a single "..." placeholder.
 */
function buildPrunedTree(root: TreeNode, selectedFolderPaths: string[]): TreeNode {
    // If there's only one selection, we can skip showing its parent unless it's shared.
    // If multiple selections share a deeper parent, we show that parent to keep them side-by-side.

    // 1) For each selected folder, find the path (sequence of TreeNodes) from root -> that folder.
    const paths: TreeNode[][] = [];
    for (const folderPath of selectedFolderPaths) {
        const pathFromRoot = findPath(root, folderPath);
        if (pathFromRoot) {
            paths.push(pathFromRoot);
        }
    }

    if (paths.length === 0) {
        // Should not happen unless selection is invalid
        return {
            name: '(empty)',
            fullPath: '',
            children: []
        };
    }

    // 2) Find the "lowest common ancestor" (LCA) among all selected paths.
    //    The LCA is the deepest TreeNode that appears in all path arrays in the same position.
    const lcaNode = findLowestCommonAncestor(paths);
    if (!lcaNode) {
        // Fallback: no common ancestor found, which is unusual; just show the root
        return root;
    }

    // 3) If there's only one selected folder (or if the LCA is exactly that folder),
    //    we skip showing the parent. We basically treat that folder as the "root" of our pruned tree.
    const singleFolder = (selectedFolderPaths.length === 1);
    const lcaIsSingleFolder =
        singleFolder && path.normalize(lcaNode.fullPath) === path.normalize(selectedFolderPaths[0]);

    // If only one folder is selected OR all selections lead to the same folder => show just that folder
    // If multiple selections share the same LCA => show that parent so you can see both children
    let newRoot: TreeNode = lcaNode;
    if (singleFolder && lcaIsSingleFolder) {
        // The LCA is the one folder, so we skip parent nodes altogether
        newRoot = lcaNode; // just that node
    }
    else if (singleFolder) {
        // If there's only one folder selected but the LCA is a deeper parent,
        // "It should not show the parent if the selected folder is the oldest sibling."
        // so we directly pick that folder from the path's last node.
        newRoot = paths[0][paths[0].length - 1];
    }
    // if multiple => keep lcaNode as-is

    // 4) Clone the subtree from newRoot downward so we can prune siblings
    const clonedSubtree = deepCloneTree(newRoot);

    // 5) Prune that subtree to keep only the paths leading to selected folders
    //    plus the children of the selected folders, plus "..." placeholders for omitted siblings.
    const prunedSubtree = pruneChildren(clonedSubtree, selectedFolderPaths);

    return prunedSubtree;
}

/**
 * Return the path (array of TreeNodes) from 'root' to the node with fullPath = 'targetPath',
 * or null if not found.
 */
function findPath(root: TreeNode, targetPath: string): TreeNode[] | null {
    // DFS approach
    if (path.normalize(root.fullPath) === path.normalize(targetPath)) {
        return [root];
    }
    if (root.children) {
        for (const child of root.children) {
            const childPath = findPath(child, targetPath);
            if (childPath) {
                return [root, ...childPath];
            }
        }
    }
    return null;
}

/**
 * Given an array of path arrays (each path is root->...->selectedFolder),
 * find the lowest common ancestor node among them (deepest node that all paths share).
 */
function findLowestCommonAncestor(paths: TreeNode[][]): TreeNode | null {
    if (paths.length === 0) return null;
    if (paths.length === 1) {
        // Only one path => the LCA is simply the entire path. We pick the last node, or the first—depending on usage.
        // We'll just pick the entire path. The caller can decide how to handle it.
        return paths[0][paths[0].length - 1];
    }

    // Compare the arrays step-by-step to see how far they match
    let minLen = Math.min(...paths.map(p => p.length));
    let lastCommonIndex = -1;

    for (let i = 0; i < minLen; i++) {
        const candidate = paths[0][i].fullPath;
        if (paths.every(pathArr => path.normalize(pathArr[i].fullPath) === path.normalize(candidate))) {
            lastCommonIndex = i;
        } else {
            break;
        }
    }
    if (lastCommonIndex < 0) {
        return null; // no commonality at all
    }

    // The LCA is the lastCommonIndex node in any path (they are all the same at that index)
    return paths[0][lastCommonIndex];
}

/**
 * Prune the subtree so that it only includes:
 *   - The path(s) to the selected folders (if they are descendants)
 *   - The children of any selected folder
 *   - "..." placeholders for any omitted siblings
 *
 * We mutate the root node in-place, returning the same reference (for convenience).
 */
function pruneChildren(root: TreeNode, selectedFolderPaths: string[]): TreeNode {
    if (!root.children || root.children.length === 0) {
        return root;
    }

    let relevantChildren: TreeNode[] = [];
    let hasIrrelevant = false;

    for (const child of root.children) {
        if (isRelevant(child, selectedFolderPaths)) {
            // Keep child (recursively prune below)
            child.children = pruneChildren(child, selectedFolderPaths).children;
            relevantChildren.push(child);
        } else {
            hasIrrelevant = true;
        }
    }

    // If there was at least one irrelevant sibling, add a placeholder
    if (hasIrrelevant) {
        relevantChildren.push({
            name: '...',
            fullPath: '',
            children: []
        });
    }

    root.children = relevantChildren;
    return root;
}

/**
 * A node is "relevant" if it is on the path to a selected folder, or it *is* a selected folder,
 * or it is a descendant of a selected folder.
 */
function isRelevant(node: TreeNode, selectedPaths: string[]): boolean {
    return selectedPaths.some(folderPath => {
        // node is relevant if node is ancestor/descendant of folderPath
        // i.e. node.fullPath is a prefix of folderPath OR folderPath is a prefix of node.fullPath
        return isAncestorOrSelf(node.fullPath, folderPath) ||
               isAncestorOrSelf(folderPath, node.fullPath);
    });
}

/**
 * Return true if 'possibleAncestor' is the same as 'possibleDescendant' or is
 * a directory above it in the path hierarchy (without stepping outside).
 */
function isAncestorOrSelf(possibleAncestor: string, possibleDescendant: string): boolean {
    const rel = path.relative(possibleAncestor, possibleDescendant);
    // If it doesn't start with "..", then possibleAncestor is an ancestor or the same path
    return !rel.startsWith('..');
}

/**
 * Create a deep copy of a TreeNode (recursively).
 */
function deepCloneTree(node: TreeNode): TreeNode {
    return {
        name: node.name,
        fullPath: node.fullPath,
        children: node.children
            ? node.children.map(c => deepCloneTree(c))
            : []
    };
}

/**
 * Render the (pruned) tree in an ASCII/Unicode style similar to `tree` command.
 */
function renderTree(
    node: TreeNode,
    prefix: string = '',
    isLast: boolean = true
): string {
    const connector = isLast ? '└── ' : '├── ';
    let line = `${prefix}${connector}${node.name}\n`;

    if (!node.children || node.children.length === 0) {
        return line;
    }

    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
        const last = index === node.children!.length - 1;
        line += renderTree(child, newPrefix, last);
    });

    return line;
}

export function deactivate() {}
