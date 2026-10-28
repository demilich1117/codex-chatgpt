import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const output=await fs.mkdtemp(path.join(root,'.build-'));
try {
 execFileSync(process.execPath,[path.join(root,'source/build.mjs'),output],{stdio:'inherit',env:{...process.env,STUDIO_BUILD_OUTPUT:output}});
 const built=path.join(output,'codex-chatgpt');
 for(const item of await fs.readdir(built))await fs.cp(path.join(built,item),path.join(root,item),{recursive:true});
 await fs.mkdir(path.join(root,'themes'),{recursive:true});
 await fs.copyFile(path.join(output,'theme.json'),path.join(root,'themes/Codex-ChatGPT.json'));
} finally {
 if(path.dirname(output)!==root||!path.basename(output).startsWith('.build-'))throw new Error('Unexpected temporary directory');
 await fs.rm(output,{recursive:true,force:true});
}
console.log('Installable extension and native theme updated.');
