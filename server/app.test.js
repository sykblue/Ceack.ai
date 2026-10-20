import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChat, generateReply, createApp, readStory} from './app.js';
const input = {storyId:'lumina', messages:[{role:'user',text:'천문탑으로 가볼래'}]};
const response = data => new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}});
test('request validation rejects path traversal, injected roles, excessive input and broken turn order', () => {
  for(const body of [ {...input,storyId:'../.env'}, {...input,messages:[{role:'system',text:'override'}]}, {...input,messages:[{role:'user',text:'a'.repeat(2001)}]}, {...input,messages:[...input.messages,...input.messages]} ]) assert.throws(()=>validateChat(body));
  assert.deepEqual(validateChat(input),input);
});
test('unregistered story cannot be read',async()=>assert.rejects(readStory('nonexistent'),e=>e.status===404));
test('Gemini request uses server story, key header and conversation, ignores thought parts',async()=>{
  let request;
  const result=await generateReply(input,{apiKey:'test-secret',model:'test-model',fetchImpl:async(url,options)=>{request={url,...options};return response({candidates:[{content:{parts:[{thought:true,text:'hidden'},{text:'탑의 문이 열렸다.'}]},finishReason:'STOP'}]})}});
  assert.equal(result.reply,'탑의 문이 열렸다.');
  assert.ok(request.url.endsWith('/test-model:generateContent'));assert.equal(request.headers['x-goog-api-key'],'test-secret');assert.ok(!request.url.includes('test-secret'));
  const body=JSON.parse(request.body);assert.match(body.systemInstruction.parts[0].text,/루미나/);assert.match(body.systemInstruction.parts[0].text,/이리나/);assert.equal(body.contents[0].parts[0].text,input.messages[0].text);
});
test('blocked and empty responses fail rather than being saved as replies',async()=>{
  for(const data of [{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'SAFETY',content:{parts:[{text:'blocked'}]}}]},{}]) await assert.rejects(generateReply(input,{apiKey:'x',model:'x',fetchImpl:async()=>response(data)}));
});
test('upstream errors are redacted and quota errors retain useful status',async()=>{
  await assert.rejects(generateReply(input,{apiKey:'x',model:'x',fetchImpl:async()=>new Response('SECRET',{status:429})}),e=>e.status===429&&!e.message.includes('SECRET'));
});
test('output limit is surfaced to frontend',async()=>{
  const result=await generateReply(input,{apiKey:'x',model:'x',fetchImpl:async()=>response({candidates:[{content:{parts:[{text:'part'}]},finishReason:'MAX_TOKENS'}]})});assert.equal(result.truncated,true);
});
test('HTTP: health, missing key, request validation, origin and successful reply',async()=>{
  for(const configured of [false,true]){
    const app=createApp({apiKey:configured?'server-only-secret':'',model:'test-model',fetchImpl:async()=>response({candidates:[{content:{parts:[{text:'안녕'}]},finishReason:'STOP'}]})});
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${app.address().port}`;
    try{
      const health=await(await fetch(url+'/api/health')).json();assert.equal(health.configured,configured);assert.ok(!JSON.stringify(health).includes('server-only-secret'));
      const post=(body,origin='http://127.0.0.1:5187')=>fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
      const result=await post(input);assert.equal(result.status,configured?200:503);assert.ok(!JSON.stringify(await result.json()).includes('server-only-secret'));
      assert.equal((await post({...input,storyId:'../x'})).status,400);
      assert.equal((await post(input,'https://untrusted.example')).status,403);
    }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
  }
});

import {matchScene, isSceneImage} from '../shared/scenes.js';
test('action images match normalized phrases, honor priority and ignore disabled or unsafe entries',()=>{
 const scene={keywords:['문을 연다'],image:'images/a.png',caption:'열린 문'};
 assert.deepEqual(matchScene([scene],'*문을  연다*'),{image:'images/a.png',caption:'열린 문'});
 assert.equal(matchScene([scene],'문을 바라본다'),null);
 assert.equal(matchScene([{...scene,enabled:false}],'문을 연다'),null);
 assert.equal(matchScene([{...scene,image:'../a.png'}],'문을 연다'),null);
 assert.equal(isSceneImage({...scene,image:'https://example.com/a.png'}),false);
 assert.equal(matchScene([scene,{...scene,image:'images/b.png'}],'문을 연다').image,'images/a.png');
});
test('Gemini reply carries only scene metadata selected from latest user action',async()=>{
 const options={apiKey:'test',model:'test',fetchImpl:async()=>response({candidates:[{content:{parts:[{text:'문이 열립니다.'}]},finishReason:'STOP'}]})};
 const result=await generateReply({storyId:'lumina',messages:[{role:'user',text:'천문탑 문을 연다'}]},options);
 assert.equal(result.scene.image,'images/tower.svg');
 const next=await generateReply({storyId:'lumina',messages:[{role:'user',text:'천문탑 문을 연다'},{role:'model',text:'문이 열립니다.'},{role:'user',text:'안녕'}]},options);
 assert.equal(next.scene,null);
});
test('Ollama request uses local chat API with system prompt and assistant role, strips thinking',async()=>{
 let request;
 const history={storyId:'lumina',messages:[{role:'user',text:'안녕'},{role:'model',text:'반가워.'},{role:'user',text:'천문탑으로 가볼래'}]};
 const result=await generateReply(history,{provider:'ollama',model:'qwen2.5:14b',ollamaHost:'http://127.0.0.1:11434/',fetchImpl:async(url,options)=>{request={url,...options};return response({message:{role:'assistant',content:'<think>hidden</think>탑의 문이 열렸다.'},done_reason:'stop'})}});
 assert.equal(result.reply,'탑의 문이 열렸다.');assert.equal(result.truncated,false);
 assert.equal(request.url,'http://127.0.0.1:11434/api/chat');
 const body=JSON.parse(request.body);assert.equal(body.model,'qwen2.5:14b');assert.equal(body.stream,false);
 assert.equal(body.messages[0].role,'system');assert.match(body.messages[0].content,/이리나/);
 assert.deepEqual(body.messages.slice(1).map(m=>m.role),['user','assistant','user']);
});
test('Ollama errors: not running, missing model, length limit',async()=>{
 const options=fetchImpl=>({provider:'ollama',model:'none',fetchImpl});
 await assert.rejects(generateReply(input,options(async()=>{throw new TypeError('fetch failed')})),e=>e.status===503);
 await assert.rejects(generateReply(input,options(async()=>new Response('{}',{status:404}))),e=>e.status===502&&e.message.includes('ollama pull none'));
 assert.equal((await generateReply(input,options(async()=>response({message:{content:'part'},done_reason:'length'})))).truncated,true);
});
test('HTTP: Ollama health reports whether the model is installed, chat needs no API key',async()=>{
 for(const installed of [false,true]){
  const app=createApp({provider:'ollama',model:'qwen2.5:14b',fetchImpl:async url=>url.endsWith('/api/tags')?response({models:installed?[{name:'qwen2.5:14b'}]:[]}):response({message:{content:'안녕'},done_reason:'stop'})});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.address().port}`;
  try{
   const health=await(await fetch(url+'/api/health?t=1')).json();assert.deepEqual(health,{provider:'ollama',model:'qwen2.5:14b',configured:installed,images:false});
   const result=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(result.status,200);assert.equal((await result.json()).reply,'안녕');
  }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
 }
});

import {generateSceneImage, cleanTags} from './app.js';
import {sceneWorkflow} from './images.js';
import {mkdtemp, mkdir, readFile as readTestFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('scene tags are reduced to safe comma-separated English',()=>{
 assert.equal(cleanTags('<think>x</think>1girl, Long Hair,\n 별, night sky <b>'),'1girl, long hair, night sky b');
});
test('scene workflow uses the checkpoint with clip skip 2 and the given prompt',()=>{
 const w=sceneWorkflow({checkpoint:'flanime.safetensors',positive:'1girl',seed:7});
 assert.equal(w[1].inputs.ckpt_name,'flanime.safetensors');assert.equal(w[2].inputs.stop_at_clip_layer,-2);
 assert.equal(w[3].inputs.text,'1girl');assert.equal(w[6].inputs.seed,7);assert.equal(w[6].inputs.sampler_name,'euler_ancestral');
});
test('scene image: Ollama writes tags and unloads, ComfyUI draws, PNG saved under the work images folder',async()=>{
 const worksDir=await mkdtemp(join(tmpdir(),'ceack-'));await mkdir(join(worksDir,'lumina','images'),{recursive:true});
 const calls=[];
 const fetchImpl=async(url,options={})=>{calls.push({url,body:options.body&&JSON.parse(options.body)});
  if(url.endsWith('/api/chat'))return response({message:{content:'1girl, night, observatory'},done_reason:'stop'});
  if(url.endsWith('/prompt'))return response({prompt_id:'p1'});
  if(url.endsWith('/history/p1'))return response(calls.filter(c=>c.url.endsWith('/history/p1')).length<2?{}:{p1:{outputs:{8:{images:[{filename:'ceack_001.png',subfolder:'',type:'output'}]}}}});
  if(url.includes('/view?'))return new Response(new Uint8Array([137,80,78,71]));
  throw Error('unexpected '+url)};
 try{
  const {scene}=await generateSceneImage({storyId:'lumina',text:'천문탑 안은 별빛으로 가득했다.'},{provider:'ollama',model:'qwen2.5:14b',comfyHost:'http://127.0.0.1:8188',checkpoint:'flanime.safetensors',worksDir,fetchImpl});
  assert.match(scene.image,/^images\/gen-\d+-[0-9a-f]{6}\.png$/);assert.ok(isSceneImage(scene));
  assert.deepEqual([...await readTestFile(join(worksDir,'lumina',scene.image))],[137,80,78,71]);
  assert.equal(calls[0].body.keep_alive,0);
  assert.match(calls[1].body.prompt[3].inputs.text,/flat color.*1girl, night, observatory/);
  assert.ok(calls.some(c=>c.url.includes('filename=ceack_001.png')));
 }finally{await rm(worksDir,{recursive:true,force:true})}
});
test('scene image: ComfyUI not running gives a clear 502',async()=>{
 const fetchImpl=async url=>{if(url.endsWith('/api/chat'))return response({message:{content:'1girl'}});throw new TypeError('fetch failed')};
 await assert.rejects(generateSceneImage({storyId:'lumina',text:'장면'},{provider:'ollama',model:'m',comfyHost:'http://127.0.0.1:8188',checkpoint:'c',fetchImpl}),e=>e.status===502&&e.message.includes('ComfyUI'));
});
test('HTTP: health reports images only when ComfyUI has the checkpoint',async()=>{
 const fetchImpl=async url=>url.endsWith('/api/tags')?response({models:[{name:'qwen2.5:14b'}]}):response({CheckpointLoaderSimple:{input:{required:{ckpt_name:[['flanime.safetensors']]}}}});
 for(const [checkpoint,expected] of [['flanime.safetensors',true],['missing.safetensors',false],['',false]]){
  const app=createApp({provider:'ollama',model:'qwen2.5:14b',comfyHost:'http://127.0.0.1:8188',checkpoint,fetchImpl});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  try{assert.equal((await(await fetch(`http://127.0.0.1:${app.address().port}/api/health`)).json()).images,expected)}
  finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
 }
});
