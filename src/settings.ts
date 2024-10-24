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



////////////////////////////////////////////////////////////////////////////////
/*/  CONSTANTS & ENUMS                                                       /*/
////////////////////////////////////////////////////////////////////////////////
export let EXTENSION_NAME = "relatedfileview";
export let TEMP_FILE_NAME = "Related Files View"
let CONFIGS = vscode.workspace.getConfiguration(EXTENSION_NAME);

export enum STORAGE_NAMES {
    RFTempFileUrl = "rfTempFileUrl"
}

export enum CONFIG_NAMES {
    ActivationMode = "activationMode",
    SearchMode = "searchMode",
    LockRelatedFiles = "lockRelatedFiles",
    BlockNonRelatedFiles = "blockNonRelatedFiles",
    SearchSubFolders = "searchSubFolders",
    CustomSearchGlobs = "customSearchGlobs",
    IncludedFileExtensions = "includedFileExtensions",
    ExcludedFiles = "excludedFiles",
    ShowInitialised = "showInitialised"
}

export enum ACTIVATION_MODE {
    OnEditorChange = "On Editor Change",
    Manual = "Manual"
}

export enum SEARCH_MODE {
    Root = "Root",
    Parent = "Parent",
    Sibling = "Sibling",
    Custom = "Custom"
}



////////////////////////////////////////////////////////////////////////////////
/*/  CLASS                                                                   /*/
////////////////////////////////////////////////////////////////////////////////
export class Config {

    // PROPERTIES  /////////////////////////////////////////////////////////////    
    public get activationMode() { 
        return this.getConfigOrDefault<ACTIVATION_MODE>
        (CONFIG_NAMES.ActivationMode, ACTIVATION_MODE.OnEditorChange);
    }

    public get searchMode() {
        return this.getConfigOrDefault<SEARCH_MODE>
        (CONFIG_NAMES.SearchMode, SEARCH_MODE.Parent);
    }

    public get lockRelatedFiles() {
        return this.getConfigOrDefault<boolean>
        (CONFIG_NAMES.LockRelatedFiles, true);
    }

    public get blockNonRelatedFiles() {
        return this.getConfigOrDefault<boolean>
        (CONFIG_NAMES.BlockNonRelatedFiles, true);
    }

    public get searchSubFolders() {
        return this.getConfigOrDefault<boolean>
        (CONFIG_NAMES.SearchSubFolders, true);
    }

    public get customSearchGlobs() {
        return this.getConfigOrDefault<string[]>
        (CONFIG_NAMES.CustomSearchGlobs, ["**/*"]);
    }

    public get includedFileExtensions() {
        return this.getConfigOrDefault<string[]>
        (CONFIG_NAMES.IncludedFileExtensions, [".*"]);
    }

    public get excludedFiles() {
        return this.getConfigOrDefault<string[]>
        (CONFIG_NAMES.ExcludedFiles, [""]);
    }

    public get showInitialised() {
        return this.getConfigOrDefault<boolean>
        (CONFIG_NAMES.ShowInitialised, true);
    }
    
    private getConfigOrDefault<T>(name: CONFIG_NAMES, _default: T) : T {
        // Validity Check
        if (!CONFIGS.has(name)) {
            console.error(`Couldn't get config value: ${name}, using default value instead.`);
            return _default;
        }

        // Return Value
        let value = CONFIGS.get<T>(name);
        console.log(`${name}: ${value}`)
        return (value === undefined) ? _default : value!;
    }

    public static updateValue<T>(name: CONFIG_NAMES, value:T, ) {
        // Validity Check
        if (!CONFIGS.has(name)) {
            console.error(`Couldn't find config value: ${name}.`);
            return;
        }

        CONFIGS.update(name, value);
    }

    public reload(e : vscode.ConfigurationChangeEvent) {
        // Update Configs
        CONFIGS = vscode.workspace.getConfiguration(EXTENSION_NAME);
        
        // Only Concerned With Reloading For Activation Mode
        let updateActivationMode = e.affectsConfiguration(`${EXTENSION_NAME}.${CONFIG_NAMES.ActivationMode}`);
        if(!updateActivationMode) { return; }

        // Ask User To Reload Their Window
        vscode.window.showWarningMessage(
            "Related Files View: You need to reload VSCode for this configuration change to take effect."
            ,"Restart Now"
        ).then((onFulfilled) => {
            if (onFulfilled === "Restart Now") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
    }
}



////////////////////////////////////////////////////////////////////////////////
/*/  PROPERTIES & VARIABLES                                                  /*/
////////////////////////////////////////////////////////////////////////////////
export const config = new Config();



////////////////////////////////////////////////////////////////////////////////
/*/  FUNCTIONS                                                               /*/
////////////////////////////////////////////////////////////////////////////////
export async function getOrSetGlobalState<T>(context: vscode.ExtensionContext, key:string, func: ()=>Promise<T>) {
    let value = context.globalState.get<T>(`${EXTENSION_NAME}.${key}`);
    if (value === undefined) {
        value = await func();
        context.globalState.update(`${EXTENSION_NAME}.${key}`, value);
    }

    return value;
}