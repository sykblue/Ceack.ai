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
