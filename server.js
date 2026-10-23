import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleApi} from './api/index.js';
const base=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(req.url?.startsWith('/api/'))return handleApi(req,res);
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const full=path.resolve(base,'public',file);
  if(!full.startsWith(path.resolve(base,'public')+path.sep)){res.writeHead(403);return res.end()}
  try{const content=await fs.readFile(full);res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"frame-ancestors 'self'"});res.end(req.method==='HEAD'?undefined:content)}catch{res.writeHead(404);res.end('Not found')}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT)||3000,()=>console.log('RhymeOrbit listening on http://localhost:'+(process.env.PORT||3000)));
export {server};
