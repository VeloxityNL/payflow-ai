import express from 'express';
const app=express(); app.use(express.json());
app.get('/health',(req,res)=>res.json({ok:true,project:'PayFlow AI'}));
app.get('/',(req,res)=>res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>PayFlow AI</title><style>body{font-family:system-ui;max-width:900px;margin:60px auto;padding:24px;background:#0b1020;color:#fff}h1{font-size:52px;margin-bottom:8px}.card{background:#151c32;padding:24px;border-radius:18px;margin-top:24px}code{color:#8dd6ff}</style><h1>PayFlow AI</h1><p>AI-powered freelance scoping and PayPal payment automation.</p><div class="card"><b>Hackathon scaffold is live.</b><p>Next: local AI scope analysis + PayPal Sandbox checkout/webhooks.</p></div>`));
const port=process.env.PORT||8810; app.listen(port,'127.0.0.1',()=>console.log('PayFlow AI on '+port));
