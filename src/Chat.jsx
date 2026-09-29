import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, Send, Square, RotateCcw, MessageCircle, Sparkles, AlertCircle, ChevronRight} from 'lucide-react';
import './chat.css';
import {isSceneImage} from '../shared/scenes.js';
function SceneImage({scene, storyId}) {
 const [failed,setFailed]=useState(false);
 if(!isSceneImage(scene)) return null;
 return <figure className="scene-image">{failed?<div className="scene-missing">장면 이미지를 불러오지 못했어요.</div>:<img src={`/works/${storyId}/${scene.image}`} alt={scene.caption || '스토리 장면'} onError={()=>setFailed(true)}/>}<figcaption>{scene.caption}</figcaption></figure>;
}
const storageKey = id => `ceack-chat-v1-${id}`;
function readHistory(id) {
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey(id)) || '[]');
    if (!Array.isArray(rows) || rows.length % 2 || rows.some((m,i) => !m || m.role !== (i%2 ? 'model' : 'user') || typeof m.text !== 'string')) return [];
    return rows.slice(-100);
  } catch { return []; }
}
export default function Chat({story, onBack}) {
  const [messages, setMessages] = useState(() => readHistory(story.id));
  const [draft, setDraft] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [status, setStatus] = useState('checking'), [storageWarning, setStorageWarning] = useState(''), [confirmReset, setConfirmReset] = useState(false), [notice, setNotice] = useState('');
  const abortRef = useRef(null), bottomRef = useRef(null), inputRef = useRef(null), mounted = useRef(true), sending = useRef(false);
  async function checkStatus(signal) {
    setStatus('checking');
    try { const res = await fetch('/api/health', {signal}); if(!res.ok) throw Error(); const data = await res.json(); if(mounted.current) setStatus(data.configured ? 'ready' : 'missing'); }
    catch(e) { if(e.name !== 'AbortError' && mounted.current) setStatus('offline'); }
  }
  useEffect(() => { mounted.current = true; const controller = new AbortController(); checkStatus(controller.signal); return () => {mounted.current=false;controller.abort();abortRef.current?.abort()}; }, []);
  useEffect(() => { try { localStorage.setItem(storageKey(story.id), JSON.stringify(messages)); setStorageWarning(''); } catch {setStorageWarning('브라우저 저장 공간을 사용할 수 없어 이 대화는 저장되지 않습니다.')} }, [messages, story.id]);
  useEffect(() => {bottomRef.current?.scrollIntoView({block:'end', behavior:'auto'})}, [messages, busy, error]);
  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || text.length > 2000 || sending.current || status !== 'ready') return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); abortRef.current=controller;
    const timer = setTimeout(() => controller.abort('timeout'), 65000);
    try {
      // Send only complete recent turns; the server adds the authoritative story settings.
      const res = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({storyId:story.id,messages:[...messages.slice(-20), {role:'user',text}]}),signal:controller.signal});
      const data = await res.json().catch(() => ({}));
      if(!res.ok) throw Error(data.error || '메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      if(typeof data.reply !== 'string' || !data.reply.trim()) throw Error('답변이 비어 있습니다. 다시 시도해 주세요.');
      if(mounted.current) {setMessages(prev=>[...prev,{role:'user',text},{role:'model',text:data.reply,...(isSceneImage(data.scene)?{scene:data.scene}:{})}].slice(-100));setDraft('');if(data.truncated)setNotice('답변이 길이 제한에 도달했습니다. “계속해 줘”라고 보내면 이어갈 수 있습니다.');}
    } catch(e) { if(mounted.current) setError(controller.signal.aborted ? controller.signal.reason==='timeout' ? '응답 시간이 초과되었습니다. 입력한 메시지는 유지됩니다.' : '응답 요청을 중지했습니다. 입력한 메시지는 유지됩니다.' : e.message); }
    finally {clearTimeout(timer);sending.current=false;if(mounted.current){setBusy(false);inputRef.current?.focus()}}
  }
  const statusLabel = {checking:'연결 확인 중',ready:'대화 준비됨',missing:'API 키 설정 필요',offline:'서버 연결 필요'}[status];
  return <div className="chat-page"><header className="chat-header"><button className="icon-button" onClick={onBack} aria-label="작품 목록으로 돌아가기"><ArrowLeft size={21}/></button><div><span className="chat-eyebrow">CEACK ORIGINAL</span><h1>{story.title}</h1></div><span className={`connection ${status}`} role="status"><i/>{statusLabel}</span><button className="chat-reset" aria-label="새 대화" disabled={busy} onClick={()=>setConfirmReset(true)}><RotateCcw size={15}/><span>새 대화</span></button></header>
  <div className="chat-layout"><aside className="chat-sidebar"><img src={`/works/${story.id}/${story.cover}`} alt={`${story.title} 표지`} onError={e=>{e.currentTarget.style.display='none'}}/><span className="section-eyebrow">{story.category}</span><h2>{story.title}</h2><p>{story.description}</p><div className="tags">{story.tags.map(t=><span key={t}>#{t}</span>)}</div><div className="chat-storage-note"><MessageCircle size={17}/><p>이 브라우저에서 대화를 이어갈 수 있어요.<br/>최근 50회 대화가 저장됩니다.</p></div></aside>
  <section className="conversation" aria-label="작품 대화"><div className="message-list"><div className="chat-opening"><span><Sparkles size={13}/> 이야기의 첫 장</span><p>{story.opening}</p></div><div className="conversation-messages" aria-live="polite" aria-relevant="additions">{messages.map((m,i)=><article key={i} className={`message ${m.role}`}><span className="message-label">{m.role==='user'?'나':story.title}</span><p>{m.text}</p>{m.role==='model'&&m.scene&&<SceneImage scene={m.scene} storyId={story.id}/>}</article>)}{busy&&<><article className="message user"><span className="message-label">나</span><p>{draft.trim()}</p></article><div className="typing" role="status"><i/><i/><i/><span>이야기를 이어가는 중이에요</span></div></>}</div>
  {status==='missing'&&<div className="connection-help"><AlertCircle size={19}/><div><strong>대화를 시작하기 전에 API 키를 설정해 주세요.</strong><p>프로젝트의 <code>.env</code> 파일에 <code>GEMINI_API_KEY</code>를 입력하고 서버를 다시 실행하세요. 키는 이 화면에 입력하지 않습니다.</p><button onClick={()=>checkStatus()}>연결 다시 확인 <ChevronRight size={13}/></button></div></div>}
  {status==='offline'&&<div className="connection-help"><AlertCircle size={19}/><div><strong>대화 서버에 연결할 수 없어요.</strong><p>프로젝트에서 <code>npm run dev</code>로 화면과 서버를 함께 실행해 주세요.</p><button onClick={()=>checkStatus()}>연결 다시 확인 <ChevronRight size={13}/></button></div></div>}
  {storageWarning&&<p className="chat-error" role="alert">{storageWarning}</p>}{error&&<p className="chat-error" role="alert">{error}</p>}{notice&&<p className="chat-notice">{notice}</p>}<div ref={bottomRef}/></div>
  <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">메시지</label><textarea id="chat-message" ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy} maxLength={2000} placeholder="당신의 다음 이야기를 적어주세요…" rows={3} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e)}}}/><div className="composer-actions"><span>{draft.length}/2,000 · Shift+Enter 줄바꿈</span>{busy?<button type="button" className="stop-button" onClick={()=>abortRef.current?.abort()}><Square size={13}/> 중지</button>:<button className="primary" disabled={!draft.trim()||status!=='ready'} type="submit"><Send size={15}/> 보내기</button>}</div><p>AI 답변은 허구이며 오류가 있을 수 있어요. 메시지를 보내면 최근 대화가 Google Gemini에 전달됩니다.</p></form></section></div>
  {confirmReset&&<div className="modal-backdrop"><section className="reset-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">새 이야기를 시작할까요?</h2><p>이 작품의 현재 브라우저 대화 기록이 지워집니다.</p><div><button autoFocus onClick={()=>setConfirmReset(false)}>취소</button><button className="primary" onClick={()=>{setMessages([]);setDraft('');setError('');setNotice('');setConfirmReset(false)}}>새 대화 시작</button></div></section></div>}
  </div>;
}
