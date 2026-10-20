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
   const health=await(await fetch(url+'/api/health?t=1')).json();assert.deepEqual(health,{provider:'ollama',model:'qwen2.5:14b',configured:installed});
   const result=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(result.status,200);assert.equal((await result.json()).reply,'안녕');
  }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
 }
});
