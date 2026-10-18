// Package-free syntax + pure-code smoke tests; NOT a substitute for npm test/build or Android compilation.
const fs=require('node:fs'), path=require('node:path'),vm=require('node:vm'), assert=require('node:assert/strict');
let ts;
try { ts=require('typescript'); } catch { ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
const root=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)])}
let checked=0;
for(const f of walk(path.join(root,'src')).filter(f=>/\.tsx?$/.test(f))){
  const src=fs.readFileSync(f,'utf8');
  const compiled=ts.transpileModule(src,{fileName:f,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
  const errors=compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];
  assert.equal(errors.length,0,`${path.relative(root,f)}: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join(', ')}`);
  checked++;
}
function moduleFrom(name,requires={}){
  const f=path.join(root,name);let code=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,URL,AbortSignal,fetch}, {filename:f})(s=>{if(s in requires)return requires[s];throw new Error('Unexpected import '+s)},mod,mod.exports);
  return mod.exports;
}
const lib=moduleFrom('src/features/library/library-utils.ts');
assert.equal(lib.fileKind('a.PNG'),'image');
assert.equal(lib.fileKind('a.MP4'),'video');
assert.equal(lib.fileKind('a.7Z'),'archive');
assert.equal(lib.fileKind('a.FLAC'),'audio');
const make=(id,name,status,date,favorite)=>({id,filename:name,status,createdAt:date,favorite,totalBytes:date,url:'https://example.com/'+name});
const entries=[make('1','b.png','success',20,true),make('2','a.mp4','success',10,false),make('3','c.png','running',100),{...make('4','sample.png','success',60),sample:true}];
assert.deepEqual(Array.from(lib.libraryItems(entries,{}),e=>e.id),['1','2']);
assert.deepEqual(Array.from(lib.libraryItems(entries,{favoriteOnly:true}),e=>e.id),['1']);
assert.deepEqual(Array.from(lib.libraryItems(entries,{kind:'video'}),e=>e.id),['2']);
assert.deepEqual(Array.from(lib.libraryItems(entries,{sort:'name'}),e=>e.id),['2','1']);
const util=moduleFrom('src/lib/url.ts');
assert.equal(util.validateFileUrl('https://127.0.0.1/foo').valid,false);
assert.equal(util.validateFileUrl('https://localhost/a').valid,false);
assert.equal(util.validateFileUrl('https://cdn.example.com/image.png').valid,true);
const parser=moduleFrom('src/lib/pawchive.ts',{'@capacitor/core':{Capacitor:{getPlatform:()=>'web'},CapacitorHttp:{}}});
const target=parser.parseCreatorTarget('https://pawchive.pw/patreon/user/123/post/456');
assert.equal(parser.apiUrl(target),'https://pawchive.pw/api/v1/patreon/user/123/post/456');
assert.equal(parser.normalizePosts([{id:'44',title:'A',file:{name:'one.png',path:'/files/1'}}],target)[0].attachments.length,1);
for(const bad of ['https://localhost/a','http://cdn.example.com/a','https://127.0.0.1/file'])assert.equal(parser.downloadUrl(bad,target),undefined);
const java=fs.readFileSync(path.join(root,'native/android/PawchiveDownloadsPlugin.java'),'utf8');
for(const required of ['SQLiteOpenHelper','migrateIfNeeded','@PluginMethod public void favorite','@PluginMethod public void thumbnail','@PluginMethod public void open','@PluginMethod public void delete'])assert(java.includes(required), 'missing Java method '+required);
console.log('PASS: TS/TSX syntax '+checked+' files, pure library/API smoke tests, Java bridge method presence.');
console.log('NOT tested: npm build, React typechecker, Android Java compile, real network, device app.');
