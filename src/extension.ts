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
import * as rf from './related-files';
import * as settings from './settings'
import { ACTIVATION_MODE } from './settings';



////////////////////////////////////////////////////////////////////////////////
/*/  FUNCTIONS                                                               /*/
////////////////////////////////////////////////////////////////////////////////

export function activate(context: vscode.ExtensionContext) {
    // Initialise Extension
    rf.initalise(context);

	// Register Commands
    const openRelatedFilesCommand = vscode.commands.registerCommand("relatedfileview.openRelatedFiles", rf.openRelatedFiles);
    context.subscriptions.push(openRelatedFilesCommand);
    
    // Register Event Listeners
    let openRelatedFilesListener : vscode.Disposable;
    switch (settings.config.activationMode) {
        case ACTIVATION_MODE.OnEditorChange:
            openRelatedFilesListener = vscode.window.onDidChangeActiveTextEditor(e => rf.openRelatedFiles(e?.document));
            context.subscriptions.push(openRelatedFilesListener);
            break;
    }
    
    const reloadConfigsListener = vscode.workspace.onDidChangeConfiguration(settings.config.reload);
    context.subscriptions.push(reloadConfigsListener);
    
    const maintainBlockedStateListener = vscode.workspace.onDidOpenTextDocument(rf.maintainBlockedState);
    context.subscriptions.push(maintainBlockedStateListener);

    const updateRFViewColumnListener = vscode.window.onDidChangeTextEditorViewColumn(rf.updateRFViewColumn);
    context.subscriptions.push(updateRFViewColumnListener);

    const maintainLockedStateListener = vscode.window.tabGroups.onDidChangeTabs((e) => {
        if (e.closed.length > 0)
            rf.maintainLockedState(e);
    });
    context.subscriptions.push(maintainLockedStateListener);
}


export async function deactivate() {
    // Nothing
}
