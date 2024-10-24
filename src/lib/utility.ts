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
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';



////////////////////////////////////////////////////////////////////////////////
/*/  FUNCTIONS                                                               /*/
////////////////////////////////////////////////////////////////////////////////
export function PromiseTimeout(delayms:number) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, delayms);
    });
}


function resolvePath (filepath: string): string | undefined {
    if (filepath[0] !== '~')
        return path.resolve(filepath);

    const hoveVar = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
    let start = process.env[hoveVar];

    if (start)
        return path.join(start, filepath.slice(1));
};


export async function createTemporaryFile(folderName:string, fileName:string) : Promise<URL> {
    const tempdir = resolvePath(os.tmpdir());
    const filepath = `${tempdir}${path.sep}${folderName}${path.sep}${fileName}`;
    await fs.promises.mkdir(path.dirname(filepath), {recursive: true});
    await fs.promises.writeFile(filepath, '');
    return pathToFileURL(filepath);
}