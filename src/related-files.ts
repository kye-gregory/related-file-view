/*/
    Related Files View - A VSCode Extension.
    Copyright (C) 2024  Kye Gregory

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
/*/

////////////////////////////////////////////////////////////////////////////////
/*/  IMPORTS                                                                 /*/
////////////////////////////////////////////////////////////////////////////////
import * as vscode from 'vscode';
import { Config, CONFIG_NAMES, EXTENSION_NAME, SEARCH_MODE, STORAGE_NAMES, TEMP_FILE_NAME } from './settings';
import * as settings from './settings';
import { createTemporaryFile, PromiseTimeout } from './lib/utility';
import path from 'path';



////////////////////////////////////////////////////////////////////////////////
/*/  PROPERTIES & VARIABLES                                                  /*/
////////////////////////////////////////////////////////////////////////////////
let rfViewColumn : vscode.ViewColumn | undefined;
let relatedFiles = new Set<string>();
let primaryFile : string | undefined;
let rfTempFileUri : vscode.Uri | undefined;
const config = settings.config;


////////////////////////////////////////////////////////////////////////////////
/*/  FUNCTIONS                                                               /*/
////////////////////////////////////////////////////////////////////////////////
export async function initalise(context: vscode.ExtensionContext) {
    // Load or Create Temp File
    let tempUrl = await settings.getOrSetGlobalState<string>(context, STORAGE_NAMES.RFTempFileUrl, async () => {
        let promise = await createTemporaryFile(EXTENSION_NAME, TEMP_FILE_NAME);
        return promise.toString();
    });

    // Set Temp File URI
    rfTempFileUri = vscode.Uri.parse(tempUrl);

    // Assign RF View Column
    rfViewColumn =  getTempFileColumns()[0] || Math.min(getLastViewColumn() + 1, 9);

    // Alert User Extension Is Enabled
    if (config.showInitialised) {
        vscode.window.showInformationMessage("Related Files View has intialised.", "Do Not Show Again").then((onFulfilled)=> {
            if (onFulfilled == "Do Not Show Again") {
                Config.updateValue(CONFIG_NAMES.ShowInitialised, false);
            }
        });
    }
}


export async function openRelatedFiles(document : vscode.TextDocument | undefined) {
    // Debugging Event Listeners...
    console.info("Calling: Open Related Files Function.");

    // Get Active Editor
    let activeEditor : vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    
    // Check Validity & Attempt Active Document
    if (!document) { document = activeEditor?.document }
    if (!document) { return; }

    // Occasionally errors occurs due to another file closing...
    // NOTE: Needs To Update RFView Column First If Closing Active Column
    await PromiseTimeout(100);

    // Skips Already Checked Files
    // Intended use is for user-opened related files in non-rfviewcolumn and then making that a new primary.
    let newPrimaryFile = !isPrimaryFile(document.uri) && !isTempFile(document.uri) && !(isRelatedFile(document.uri) && (activeEditor?.viewColumn == rfViewColumn));
    if (newPrimaryFile) await handleFileOpen(document);
}

/*/ Annoyingly, using this function breaks the code.
//  It changes the order of event execution, and multiple things break.
//  Unable to find an alternative workaround where I can refactor my code to use this function.
//  More than likely, would have to rewrite the whole extension to use TabEvent and TabGroupEvent exclusively.
//  To ensure the order of event execution / having the correct state at each event.
async function openUriInRFColumn(uri : vscode.Uri) {
    await vscode.workspace.openTextDocument(uri).then(async (doc) => {
        await vscode.window.showTextDocument(doc, {
            viewColumn: rfViewColumn,
            preserveFocus: true,
            preview: false
        });
    });
}
/*/


function getRFTabGroup() : vscode.TabGroup | undefined {
    return vscode.window.tabGroups.all.filter(tg => tg.viewColumn == rfViewColumn)[0];
}


async function handleFileOpen(document: vscode.TextDocument) {
    // NOTE: Not Clear, But Only This Function Only Runs Once
    // As Files Are Opened They Are Skipped In openRelatedFiles Function

    // Set Primary File
    setPrimaryFile(document.uri);

    // Set Column Marker Temp File
    // NOTE: This block must happen before relatedFilesName.clear(),
    //       due to the fact that when calling an onDidChangeTabGroups event
    //       which pauses execution and hooks into updateRFViewColumn().
    //       Therefore, requiring the previous relatedFilesName values
    //       to set the correct view column.
    if (rfTempFileUri) {
        await vscode.workspace.openTextDocument(rfTempFileUri).then(async (doc) => {
            await vscode.window.showTextDocument(doc, {
                viewColumn: rfViewColumn,
                preserveFocus: true,
                preview: false
            });
        });
    }

    // Close All Non-Related Files
    let tabGroup = getRFTabGroup();
    
    if(tabGroup) {
        let nonRFTabs = tabGroup.tabs.filter(tab => {
            return !(tab.input instanceof vscode.TabInputText && (isTempFile(tab.input.uri)))
        });

        if (nonRFTabs.length > 0)
            vscode.window.tabGroups.close(nonRFTabs);
    }
 
    // Gets Related Files
    const relatedFilePaths = await getRelatedFiles(document);
    if (!relatedFilePaths) {
        return;
    }

    // Cycle Through Each Related File...
	for (const uri of relatedFilePaths) {
        // Add To List Of Related File Names
        addRelatedFile(uri);
        
        // Open Document In RFColumn
        await vscode.workspace.openTextDocument(uri).then(async (doc) => {
            await vscode.window.showTextDocument(doc, {
                viewColumn: rfViewColumn,
                preserveFocus: true,
                preview: false
            });
        });
	}
}


async function getRelatedFiles(document : vscode.TextDocument) {
    // Reset Related Files Cache
    relatedFiles.clear();

    // Get Path Info
    const currentFilePath = document.uri.fsPath;
    const currentFolderPath = path.dirname(currentFilePath);

    // Find the workspace folder that contains the current file
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('The current file is not in a workspace.');
        return undefined;
    }

    // Define output
    let files: vscode.Uri[] = []

    // Calculate Extension Glob
    let extensionGlob = "";
    for (const extension of config.includedFileExtensions) {
        extensionGlob += `${extension},`;
    }
    extensionGlob = `{${extensionGlob.slice(0,-1)}}`;

    // Calculate File Name Glob
    let fileName = getFileName(currentFilePath);
    let fileNameGlob = `${fileName}${extensionGlob}`;
    let subFoldersGlob = `${(config.searchSubFolders)?"**/":""}${fileNameGlob}`;

    // SEARCH_MODE.CUSTOM
    if (config.searchMode == SEARCH_MODE.Custom) {
        // For Each Glob: Find Files & Append
        for (const glob of config.customSearchGlobs) {
            let globPattern = `${glob}${subFoldersGlob}`;
            const files = await vscode.workspace.findFiles(globPattern, null);
            for (const file of files) {
                files.push(file);
            }
        }

        // Return Function.
        return files.filter(fileUri => fileUri.fsPath !== currentFilePath);
    }


    // OTHER SEARCH_MODES
    // Determine Root Folder
    let rootFolderPath: string = "";
    const relativeFolderPath = path.relative(workspaceFolder.uri.fsPath, currentFolderPath);
    const relativeParentPath = path.relative(workspaceFolder.uri.fsPath, path.resolve(currentFolderPath, ".."));
    if (config.searchMode == SEARCH_MODE.Sibling) rootFolderPath = relativeFolderPath;
    if (config.searchMode == SEARCH_MODE.Parent) rootFolderPath = relativeParentPath;

    // Add Path Seperator If Required
    if (rootFolderPath.length > 0)
        rootFolderPath += "/";

    // Search For Files
    const globPattern = `${rootFolderPath}${subFoldersGlob}`;
    files = await vscode.workspace.findFiles(globPattern, null);
    return files.filter(uri => uri.fsPath !== currentFilePath);
}


// Prevents Non-Related Files From Opening On The RFViewColumn.
// Event Listener For vscode.workspace.onDidOpenTextDocument().
export async function maintainBlockedState(document : vscode.TextDocument) {
    // Get Updated Column
    // NOTE: Required due to execution order of events.
    let currentColumn = GetRFViewColumn() || rfViewColumn;

    // Check If Active Editor (Opening Location) is Current RFViewColumn.
    if (vscode.window.tabGroups.activeTabGroup.viewColumn == currentColumn) {
        // Move File Opening Location
        let column = (rfViewColumn != 1) ? 1 : 2;
        vscode.window.showTextDocument(document, {viewColumn: column as vscode.ViewColumn})
    } else {
        rfViewColumn = currentColumn;
    }
}


// Prevents Related Files From Closing From The RFViewColumn.
// Event Listener For onDidChangeTabs() event where closed.length > 1
// NOTE: This event fires before vscode.workspace.onDidCloseTextDocument().
export async function maintainLockedState(e : vscode.TabChangeEvent) {

    // Loop Over All Closed Tabs (should only every be one though)...
    for (const closedTab of e.closed) {
        // Check Lock Conditions...
        if (closedTab.input instanceof vscode.TabInputText) {
            let closedUri = closedTab.input.uri;
            let maintainLock = (isTempFile(closedUri) || isRelatedFile(closedUri));

            // Tab Should Be Locked...
            if (maintainLock) {
                // Update rfViewColumn If Closed Editor Group (i.e the temp file) For Non-Last View Column.
                if (isTempFile(closedUri) && (vscode.window.visibleTextEditors.length > closedTab.group.viewColumn))
                    rfViewColumn = getLastViewColumn();

                // Reopen Closed File
                await vscode.workspace.openTextDocument(closedUri).then(async (doc) => {
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: rfViewColumn,
                        preserveFocus: true,
                        preview: false
                    });
                });

                // Reorganise Structure...
                if (!isTempFile(closedUri)) continue;
                
                // Get Related Tab Group
                const relatedTabGroup = getRFTabGroup();
                if (!relatedTabGroup) continue;

                // Get Related Tabs
                const relatedTabs = relatedTabGroup.tabs.filter(tab => {
                    return (tab.input instanceof vscode.TabInputText && (isRelatedFile(tab.input.uri)))
                });
        
                // Close Related Tabs (not temp file)
                if (relatedTabs.length > 0)
                    vscode.window.tabGroups.close(relatedTabs);

                // Open Related Tabs Again
                for (const tab of relatedTabs) {
                    if (tab instanceof vscode.TabInputText) {
                        // Open Document & Move To Appropiate Position
                        await vscode.workspace.openTextDocument(tab.uri).then(async (doc) => {
                            await vscode.window.showTextDocument(doc, {
                                viewColumn: rfViewColumn,
                                preserveFocus: true,
                                preview: false
                            });
                        });
                    }
                }
            }
        }
    };
}


export async function updateRFViewColumn() {
    // Prevent Single Editor Bug
    // Using the await method below changes the order of event calls
    // and can cause issues because it waits until a file opens then becomes
    // undefined.
    if (vscode.window.visibleTextEditors.length == 1) {
        rfViewColumn = vscode.ViewColumn.Two;
        return;
    }
    
    // This Call Will Be Correct On TabGroup Close (it needs to call sooner.)
    rfViewColumn = GetRFViewColumn();
    
    // This Call Will Be Correct When Updating View Column (it needs to call later.)
    // Only Needs To Work If The View Column Moves (Not Opens Or Closes)
    let disposable = await vscode.window.tabGroups.onDidChangeTabGroups((e) => {
        rfViewColumn = GetRFViewColumn();
        disposable.dispose();
    });
    return;
}

// Dynamically Calculates The Correct RFViewColumn (For When View Columns Change.)
export function GetRFViewColumn() : vscode.ViewColumn | undefined {
    // Define output value
    let column : vscode.ViewColumn | undefined;

    // Find A Group Where...
    vscode.window.tabGroups.all.some(group => {
        // All Tabs Are...
        let isGroup = group.tabs.every(tab => {
            if (tab.input instanceof vscode.TabInputText) {
                // Related Or Temp Files.
                let valid = isRelatedFile(tab.input.uri) || isTempFile(tab.input.uri)
                return valid;
            }
            return false;
        });

        // And Have Atleast 1 Temp File
        isGroup = isGroup && group.tabs.some(tab => {
            if (tab.input instanceof vscode.TabInputText) {
                // Related Or Temp Files.
                let valid = isTempFile(tab.input.uri)
                return valid;
            }
            return false;
        });

        // Set Value.
        if (isGroup) {
            column = group.viewColumn;
            return true;
        }
    });
    
    // Return
    return column;
}


export function getTempFileColumns(): vscode.ViewColumn[] {
    // Search through all Tab Groups
    let tabGroups = vscode.window.tabGroups.all.filter(tg => {
        return tg.tabs.some(tab => {
            // Filter tabs with atleast 1 temp file present.
            return (tab.input instanceof vscode.TabInputText && isTempFile(tab.input.uri));
        });
    });

    // Return the View Colums for each selected Tab Group.
    return tabGroups.flatMap(tg => tg.viewColumn);
}


export function getLastViewColumn(): vscode.ViewColumn {
    // Get Last View Column
    let columnCount = vscode.window.tabGroups.all.length;
    let endColumn = Math.min(columnCount, 9);
    return endColumn as vscode.ViewColumn;
}

function getFileName(filePath: string): string {
    // Gets File Name From The First '.'
    // Unlike path.parse().name which returns from the last '.'
    //     i.e abc.module.css => abc.module
    let fileName = path.parse(filePath).base;
    return fileName.substring(0, fileName.indexOf('.'));
}

function setPrimaryFile(uri : vscode.Uri) {
    primaryFile = path.parse(uri.fsPath).base;
}

function addRelatedFile(uri : vscode.Uri) {
    relatedFiles.add(path.parse(uri.fsPath).base);
}

function isTempFile(uri : vscode.Uri): boolean {
    const fileName = path.parse(uri.fsPath).base;
    return (rfTempFileUri) ? fileName === path.parse(rfTempFileUri.fsPath).base : false;
}

function isPrimaryFile(uri : vscode.Uri): boolean {
    const fileName = path.parse(uri.fsPath).base;
	return fileName === primaryFile;
}

function isRelatedFile(uri : vscode.Uri): boolean {
    const fileName = path.parse(uri.fsPath).base;
	return relatedFiles.has(fileName);
}
