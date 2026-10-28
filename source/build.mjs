import fs from 'node:fs/promises';
import path from 'node:path';
const root=import.meta.dirname;
const output=path.resolve(process.env.STUDIO_BUILD_OUTPUT || process.argv[2] || path.join(root,'../release'));
await fs.mkdir(output,{recursive:true});
let css=await fs.readFile(path.join(root,'theme.css'),'utf8');
for(const [token,file] of [['__CG_GEIST__','Geist.woff2'],['__CG_GEIST_MONO__','GeistMono.woff2']]){
 const bytes=await fs.readFile(path.join(root,'extension/fonts',file));
 if(bytes.subarray(0,4).toString()!=='wOF2')throw new Error(`Invalid font: ${file}`);
 css=css.replace(token,`data:font/woff2;base64,${bytes.toString('base64')}`);
}
const fields=JSON.parse(await fs.readFile(path.join(root,'theme-fields.json'),'utf8'));
const theme={...fields,custom_css:css};
await fs.writeFile(path.join(output,'theme.json'),JSON.stringify(theme,null,2)+'\n');
await fs.writeFile(path.join(output,'theme.css'),css);
await fs.writeFile(path.join(output,'build.json'),JSON.stringify({schemaVersion:1,themeFile:'theme.json',assets:[],assetRefs:[]},null,2));
await fs.cp(path.join(root,'extension'),path.join(output,'codex-chatgpt'),{recursive:true});
await fs.writeFile(path.join(output,'codex-chatgpt/style.css'),css);
console.log(`Built ${fields.name}: ${output}`);
