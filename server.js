import express from 'express';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const envPath=path.join(__dirname,'.env');
if(fssync.existsSync(envPath)){
  for(const line of fssync.readFileSync(envPath,'utf8').split(/\r?\n/)){
    const i=line.indexOf('='); if(i>0 && !line.startsWith('#')) process.env[line.slice(0,i).trim()]=line.slice(i+1).trim();
  }
}

const app=express();
app.set('trust proxy',1);
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:false}));
const DATA=path.join(__dirname,'data','state.json');
const BASE='https://api-m.sandbox.paypal.com';
const PUBLIC_BASE='https://iwesley.dev/payflow-ai';
let paypalToken={value:null,expires:0};

async function state(){try{return JSON.parse(await fs.readFile(DATA,'utf8'))}catch{return {projects:[],events:[]}}}
async function save(s){await fs.mkdir(path.dirname(DATA),{recursive:true}); await fs.writeFile(DATA,JSON.stringify(s,null,2),{mode:0o600})}
function money(n){return Math.max(5,Number(n)||0).toFixed(2)}
function id(prefix='pf'){return `${prefix}_${crypto.randomBytes(6).toString('hex')}`}
async function log(type,message,meta={}){const s=await state();s.events.unshift({id:id('evt'),type,message,meta,at:new Date().toISOString()});s.events=s.events.slice(0,100);await save(s)}

async function token(){
  if(paypalToken.value && Date.now()<paypalToken.expires-60000) return paypalToken.value;
  const basic=Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r=await fetch(`${BASE}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  const d=await r.json(); if(!r.ok) throw new Error(d.error_description||d.error||'PayPal authentication failed');
  paypalToken={value:d.access_token,expires:Date.now()+d.expires_in*1000}; return d.access_token;
}
async function paypal(url,opts={}){
  const t=await token(); const r=await fetch(`${BASE}${url}`,{...opts,headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json','PayPal-Request-Id':opts.requestId||id('req'),...(opts.headers||{})}});
  const text=await r.text(); let d={};try{d=text?JSON.parse(text):{}}catch{d={raw:text}}; if(!r.ok){const e=new Error(d.message||d.error_description||`PayPal ${r.status}`);e.details=d;throw e} return d;
}

function heuristic(brief,budget){
  const b=Math.max(100,Number(budget)||600); const names=['Discovery & scope','Build core experience','QA & launch']; const weights=[.2,.55,.25];
  return {summary:`Deliver a production-ready solution for: ${brief.slice(0,180)}`,risk:'Medium',risks:['Scope ambiguity','External integration dependencies','Acceptance criteria drift'],deliverables:['Responsive working product','Core workflow and integrations','Testing and deployment notes'],milestones:names.map((name,i)=>({id:id('ms'),name,description:i===0?'Confirm scope, flows and acceptance criteria.':i===1?'Implement the agreed core experience and integrations.':'Run QA, resolve launch blockers and hand off.',amount:Number((b*weights[i]).toFixed(2)),status:'PROPOSED'}))};
}
async function aiAnalyze(brief,budget){
  const fallback=heuristic(brief,budget);
  const prompt=`You are PayFlow AI, a freelancer project scoping assistant. Return ONLY valid JSON with keys summary (string), risk (Low|Medium|High), risks (array of 3 strings), deliverables (array of 3-6 strings), milestones (array of exactly 3 objects with name, description, amount number). Total milestone amounts must equal ${Number(budget)||600}. Client brief: ${brief}`;
  try{
    const r=await fetch('http://127.0.0.1:11434/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'nivora-v0.1',messages:[{role:'system',content:'You output strict JSON only. Never use markdown.'},{role:'user',content:prompt}],temperature:.15,max_tokens:1000}),signal:AbortSignal.timeout(8000)});
    const d=await r.json(); const raw=d?.choices?.[0]?.message?.content||''; const match=raw.match(/\{[\s\S]*\}/); if(!match) throw new Error('No JSON'); const parsed=JSON.parse(match[0]);
    if(!Array.isArray(parsed.milestones)||parsed.milestones.length<1) throw new Error('Invalid milestones');
    parsed.milestones=parsed.milestones.map(m=>({...m,id:id('ms'),amount:Number(m.amount)||0,status:'PROPOSED'})); return {...fallback,...parsed,engine:'Local AI · nivora-v0.1'};
  }catch(e){return {...fallback,engine:'Local fallback',aiWarning:'Local model fallback used for this request.'}}
}

app.get('/health',async(req,res)=>{let pp=false,ai=false;try{await token();pp=true}catch{}try{const r=await fetch('http://127.0.0.1:11434/v1/models');ai=r.ok}catch{}res.json({ok:true,project:'PayFlow AI',paypalSandbox:pp,localAI:ai})});
app.get('/api/status',async(req,res)=>{const s=await state();let pp=false;try{await token();pp=true}catch{}res.json({ok:true,paypalSandbox:pp,ai:'nivora-v0.1',projects:s.projects.length,events:s.events.slice(0,12)});});
app.get('/api/projects',async(req,res)=>res.json((await state()).projects));
app.post('/api/analyze',async(req,res)=>{
  const brief=String(req.body.brief||'').trim(); const budget=Math.max(100,Number(req.body.budget)||600); const client=String(req.body.client||'Demo Client').trim();
  if(brief.length<15) return res.status(400).json({error:'Please enter a more detailed client brief.'});
  const analysis=await aiAnalyze(brief,budget); const p={id:id('proj'),client,brief,budget,currency:'USD',status:'DRAFT',analysis,createdAt:new Date().toISOString(),payments:[]};
  const s=await state();s.projects.unshift(p);await save(s);await log('AI','AI created a scoped payment plan',{projectId:p.id,engine:analysis.engine});res.json(p);
});
app.post('/api/projects/:pid/approve',async(req,res)=>{const s=await state();const p=s.projects.find(x=>x.id===req.params.pid);if(!p)return res.status(404).json({error:'Project not found'});p.status='APPROVED';p.analysis.milestones.forEach(m=>{if(m.status==='PROPOSED')m.status='APPROVED'});await save(s);await log('APPROVAL','Human approved the AI payment plan',{projectId:p.id});res.json(p)});
app.post('/api/projects/:pid/milestones/:mid/order',async(req,res)=>{
 try{const s=await state();const p=s.projects.find(x=>x.id===req.params.pid);if(!p)return res.status(404).json({error:'Project not found'});if(p.status!=='APPROVED')return res.status(409).json({error:'Approve the AI plan before creating a payment.'});const m=p.analysis.milestones.find(x=>x.id===req.params.mid);if(!m)return res.status(404).json({error:'Milestone not found'});
  const order=await paypal('/v2/checkout/orders',{method:'POST',body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:`${p.id}:${m.id}`,description:`PayFlow AI · ${m.name}`.slice(0,127),amount:{currency_code:'USD',value:money(m.amount)}}],application_context:{brand_name:'PayFlow AI',landing_page:'LOGIN',user_action:'PAY_NOW',return_url:`${PUBLIC_BASE}/?paypal=approved&project=${encodeURIComponent(p.id)}&milestone=${encodeURIComponent(m.id)}`,cancel_url:`${PUBLIC_BASE}/?paypal=cancelled&project=${encodeURIComponent(p.id)}`}})});
  m.status='PAYMENT_CREATED';m.paypalOrderId=order.id;p.payments.unshift({id:id('pay'),milestoneId:m.id,orderId:order.id,amount:m.amount,status:order.status,createdAt:new Date().toISOString()});await save(s);await log('PAYPAL','PayPal Sandbox order created',{projectId:p.id,orderId:order.id,amount:m.amount});res.json({orderId:order.id,status:order.status,approveUrl:order.links?.find(l=>l.rel==='approve')?.href});
 }catch(e){res.status(502).json({error:e.message,details:e.details?.details?.[0]?.description})}
});
app.post('/api/paypal/capture/:orderId',async(req,res)=>{try{const order=await paypal(`/v2/checkout/orders/${encodeURIComponent(req.params.orderId)}/capture`,{method:'POST',body:'{}'});const s=await state();for(const p of s.projects){const pay=p.payments.find(x=>x.orderId===req.params.orderId);if(pay){pay.status=order.status;pay.capturedAt=new Date().toISOString();const m=p.analysis.milestones.find(x=>x.id===pay.milestoneId);if(m)m.status=order.status==='COMPLETED'?'PAID':order.status;if(p.analysis.milestones.every(x=>x.status==='PAID'))p.status='PAID';}}await save(s);await log('PAYPAL','Sandbox payment captured',{orderId:order.id,status:order.status});res.json(order)}catch(e){res.status(502).json({error:e.message,details:e.details?.details?.[0]?.description})}});
app.get('/api/paypal/order/:orderId',async(req,res)=>{try{res.json(await paypal(`/v2/checkout/orders/${encodeURIComponent(req.params.orderId)}`))}catch(e){res.status(502).json({error:e.message})}});
app.post('/api/paypal/webhook',async(req,res)=>{
 try{
  const event=req.body||{}; let verified=false;
  if(process.env.PAYPAL_WEBHOOK_ID){
   const verify=await paypal('/v1/notifications/verify-webhook-signature',{method:'POST',body:JSON.stringify({auth_algo:req.get('paypal-auth-algo'),cert_url:req.get('paypal-cert-url'),transmission_id:req.get('paypal-transmission-id'),transmission_sig:req.get('paypal-transmission-sig'),transmission_time:req.get('paypal-transmission-time'),webhook_id:process.env.PAYPAL_WEBHOOK_ID,webhook_event:event})});
   verified=verify.verification_status==='SUCCESS';
  }
  if(!verified) return res.status(400).json({error:'Webhook signature verification failed'});
  const orderId=event.resource?.supplementary_data?.related_ids?.order_id||event.resource?.id||null;
  if(event.event_type==='PAYMENT.CAPTURE.COMPLETED'&&orderId){const s=await state();for(const p of s.projects){const pay=p.payments.find(x=>x.orderId===orderId);if(pay){pay.status='COMPLETED';pay.capturedAt=new Date().toISOString();const m=p.analysis.milestones.find(x=>x.id===pay.milestoneId);if(m)m.status='PAID';if(p.analysis.milestones.every(x=>x.status==='PAID'))p.status='PAID';}}await save(s);}
  await log('WEBHOOK',event.event_type||'PayPal webhook',{resourceId:event.resource?.id||null,verified:true});res.sendStatus(200)
 }catch(e){console.error('webhook',e.message);res.status(400).json({error:'Webhook verification failed'})}
});

app.use(express.static(path.join(__dirname,'public'),{maxAge:0,etag:false}));
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'})});
const port=process.env.PORT||8810; app.listen(port,'127.0.0.1',()=>console.log(`PayFlow AI on ${port}`));
