require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const sharp = require("sharp");
const Database = require("better-sqlite3");

const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const STORAGE = path.join(ROOT, "storage");
const PROJECTS = path.join(STORAGE, "projects");
fs.mkdirSync(PROJECTS, {recursive:true});
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(ROOT,"public")));
app.use("/files", express.static(STORAGE));

const db = new Database(path.join(STORAGE,"studio.db"));
db.exec(`CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, theme TEXT NOT NULL, created_at TEXT NOT NULL,
 duration INTEGER NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, video_path TEXT
)`);
const insertProject = db.prepare("INSERT INTO projects (id,title,theme,created_at,duration,status,data,video_path) VALUES (?,?,?,?,?,?,?,?)");
const updateProject = db.prepare("UPDATE projects SET status=?, data=?, video_path=? WHERE id=?");
const getProject = db.prepare("SELECT * FROM projects WHERE id=?");
const listProjects = db.prepare("SELECT id,title,theme,created_at,duration,status,video_path FROM projects ORDER BY created_at DESC LIMIT 50");

const themes = ["Aprender as cores","Números de 1 a 10","Alfabeto","Animais e seus sons","Formas geométricas","Higiene pessoal","Hábitos saudáveis","Meio ambiente","Emoções e sentimentos","Boas maneiras","Amizade e compartilhamento"];
const lyrics = "Vermelho é a maçã, amarelo é o sol; azul é o céu brilhando como um farol! Vamos descobrir, vamos aprender, com nossos amigos é bom crescer!";

function buildStory(input) {
  const theme = (input.theme || "Aprender as cores").trim().slice(0,120);
  const duration = [30,60,90].includes(Number(input.duration)) ? Number(input.duration) : 60;
  const age = input.age || "3 a 6 anos";
  const title = theme.toLowerCase().includes("cor") ? "A aventura das cores" : `A aventura de ${theme.toLowerCase()}`;
  const base = [
    ["Vamos aprender juntos!", "Lumi: Oi, amiguinhos! Eu sou a Lumi! Tico: E eu sou o Tico! Vamos descobrir algo incrível?", "Jardim alegre com Lumi, raposa laranja de jardineira turquesa e estrela amarela, ao lado de Tico, sapo verde-menta com cachecol roxo."],
    ["Uma descoberta especial", "Lumi: Olha só que descoberta! Vamos observar com atenção?", "Lumi aponta para um objeto educativo colorido enquanto Tico observa com curiosidade."],
    ["Aprender brincando", "Tico: Você consegue dizer o que é? Muito bem! Aprender fica divertido quando exploramos juntos.", "Tico apresenta um objeto grande e simples, cenário colorido e formas fáceis de reconhecer."],
    ["Vamos praticar", "Lumi: Vamos repetir juntos? Você está indo muito bem!", "Os dois personagens brincam com elementos educativos, expressões alegres e cenário ensolarado."],
    ["Cantando para lembrar", `Lumi e Tico cantam: ${lyrics}`, "Lumi e Tico dançam suavemente em um jardim com notas musicais e elementos do tema."],
    ["Até a próxima!", "Tico: Hoje aprendemos brincando! Lumi: Até a próxima aventura, amiguinhos!", "Lumi e Tico acenam para a câmera, com fundo alegre e espaço livre para legenda."]
  ];
  const scale = duration / 60;
  const scenes = base.map((s,i)=>({
    index:i+1, title:s[0], dialogue:s[1], visualPrompt:s[2],
    start:Math.round([0,8,18,28,38,52][i]*scale),
    end:Math.round(([8,18,28,38,52,60][i])*scale)
  }));
  if (theme.toLowerCase().includes("cor")) {
    scenes[1].dialogue="Lumi: Esta maçã é vermelha! Vamos falar juntos: vermelho!";
    scenes[1].visualPrompt="Lumi mostra uma maçã vermelha grande e brilhante; Tico sorri ao lado.";
    scenes[2].dialogue="Tico: Esta flor é amarela, como o sol! Amarelo!";
    scenes[2].visualPrompt="Tico aponta para uma flor amarela grande no jardim ensolarado.";
    scenes[3].dialogue="Lumi: E aquela borboleta é azul! Azul como o céu!";
    scenes[3].visualPrompt="Uma borboleta azul voa perto de Lumi e Tico em um jardim colorido.";
  } else {
    scenes[1].dialogue=`Lumi: Hoje vamos explorar ${theme.toLowerCase()}! Observe com atenção!`;
    scenes[2].dialogue="Tico: Vamos aprender uma coisa de cada vez. Você consegue!";
    scenes[3].dialogue="Lumi: Muito bem! Aprender e praticar pode ser divertido!";
  }
  return {title,theme,age,duration,style:input.style||"3D infantil",options:input.options||{music:true,dialogue:true,narration:true},lyrics,scenes,createdAt:new Date().toISOString(),mode:"roteiro local"};
}
async function improveWithGemini(story) {
  if (!process.env.GEMINI_API_KEY) return story;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL||"gemini-2.5-flash")}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const prompt = `Você é roteirista de conteúdo educativo infantil seguro. Revise e melhore somente os diálogos para o tema ${story.theme}, faixa etária ${story.age}, duração ${story.duration}s. Preserve Lumi (raposa laranja com jardineira turquesa e estrela amarela) e Tico (sapo verde-menta com cachecol roxo). Retorne JSON válido com scenes contendo index,title,dialogue,visualPrompt,start,end. Cenas originais: ${JSON.stringify(story.scenes)}. Não inclua markdown.`;
  try {
    const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})});
    if(!r.ok) throw new Error(`Gemini respondeu HTTP ${r.status}`);
    const j=await r.json();
    const txt=j.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("");
    const parsed=JSON.parse(txt);
    if(Array.isArray(parsed.scenes)&&parsed.scenes.length) { story.scenes=parsed.scenes; story.mode="roteiro Gemini"; }
  } catch(e) { story.aiWarning=`Não foi possível usar Gemini; foi mantido o roteiro local. ${e.message}`; }
  return story;
}
app.get("/api/health",(req,res)=>res.json({ok:true,geminiConfigured:!!process.env.GEMINI_API_KEY,ffmpegConfigured:true}));
app.get("/api/themes",(req,res)=>res.json({themes}));
app.get("/api/projects",(req,res)=>res.json(listProjects.all()));
app.get("/api/projects/:id",(req,res)=>{
 const p=getProject.get(req.params.id); if(!p) return res.status(404).json({error:"Projeto não encontrado."});
 res.json({...p,data:JSON.parse(p.data)});
});
app.post("/api/projects",async(req,res)=>{
 try {
  const input=req.body||{};
  if(!input.theme || (!themes.includes(input.theme) && input.theme!=="Tema personalizado" && input.theme.length>120)) return res.status(400).json({error:"Escolha um tema válido."});
  if(input.theme==="Tema personalizado" && !input.customTheme?.trim()) return res.status(400).json({error:"Digite o tema personalizado."});
  if(input.theme==="Tema personalizado") input.theme=input.customTheme.trim().slice(0,120);
  let story=buildStory(input);
  story=await improveWithGemini(story);
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  insertProject.run(id,story.title,story.theme,story.createdAt,story.duration,"roteiro pronto",JSON.stringify(story),null);
  res.json({id,...story});
 } catch(e) { res.status(500).json({error:"Não foi possível criar o roteiro.",detail:e.message}); }
});
function escapeXml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function wrapText(str,max=27){
 const words=String(str).replace(/^(Lumi|Tico|Lumi e Tico):\s*/,"").split(/\s+/); const lines=[];let line="";
 for(const w of words){if((line+" "+w).trim().length>max&&line){lines.push(line);line=w;}else line=(line+" "+w).trim();}
 if(line)lines.push(line);return lines.slice(0,3);
}
function sceneSvg(story,scene){
 const colors=["#b4e8ff","#ffddd0","#fff0a6","#d5f4c7","#e5d9ff","#c5edff"];
 const bg=colors[(scene.index-1)%colors.length];
 const isColor=story.theme.toLowerCase().includes("cor");
 const extra=isColor&&scene.index===2?'<circle cx="540" cy="650" r="85" fill="#ef4444"/><path d="M540 565 Q520 525 490 550 Q520 590 540 590" fill="#35a853"/>':
 isColor&&scene.index===3?'<g><path d="M540 630 L540 750" stroke="#27834a" stroke-width="14"/><circle cx="540" cy="615" r="50" fill="#ffd52a"/><circle cx="490" cy="615" r="32" fill="#ffda40"/><circle cx="590" cy="615" r="32" fill="#ffda40"/></g>':
 isColor&&scene.index===4?'<g><ellipse cx="485" cy="620" rx="60" ry="85" fill="#3385ff"/><ellipse cx="595" cy="620" rx="60" ry="85" fill="#3385ff"/><ellipse cx="540" cy="635" rx="25" ry="75" fill="#202c45"/></g>':'';
 const captions=wrapText(scene.dialogue,26).map((t,i)=>`<text x="540" y="${1370+i*54}" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="${i%2?"#ffeb72":"#ffffff"}" stroke="#253047" stroke-width="3" paint-order="stroke">${escapeXml(t)}</text>`).join("");
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#fff7df"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><circle cx="890" cy="190" r="80" fill="#fff6b3"/><path d="M0 1050 Q260 900 500 1080 T1080 1020 V1920 H0Z" fill="#9edc91"/>${extra}<g transform="translate(310 570)"><path d="M-70 0 L-130 -170 L0 -100 L90 -175 L95 15Z" fill="#ef8b36"/><ellipse cx="0" cy="0" rx="130" ry="145" fill="#f28b36"/><ellipse cx="0" cy="45" rx="80" ry="85" fill="#fff0d0"/><circle cx="-45" cy="-15" r="17" fill="#26334b"/><circle cx="45" cy="-15" r="17" fill="#26334b"/><path d="M-25 45 Q0 65 25 45" fill="none" stroke="#26334b" stroke-width="8" stroke-linecap="round"/><path d="M-100 105 L100 105 L85 260 L-85 260Z" fill="#21b8b0"/><path d="M-30 160 L0 130 L30 160 L0 190Z" fill="#ffe34d"/></g><g transform="translate(720 610)"><ellipse cx="0" cy="0" rx="125" ry="115" fill="#9be4c4"/><circle cx="-65" cy="-100" r="48" fill="#9be4c4"/><circle cx="65" cy="-100" r="48" fill="#9be4c4"/><circle cx="-65" cy="-100" r="20" fill="#fff"/><circle cx="65" cy="-100" r="20" fill="#fff"/><circle cx="-65" cy="-100" r="10" fill="#26334b"/><circle cx="65" cy="-100" r="10" fill="#26334b"/><ellipse cx="0" cy="25" rx="80" ry="65" fill="#c8f5df"/><path d="M-90 80 Q0 130 90 80 L70 120 Q0 155 -70 120Z" fill="#8a55c5"/><path d="M-35 40 Q0 65 35 40" fill="none" stroke="#26334b" stroke-width="7" stroke-linecap="round"/></g><text x="540" y="180" text-anchor="middle" font-family="Arial,sans-serif" font-size="55" font-weight="bold" fill="#26334b">${escapeXml(story.title)}</text><text x="540" y="285" text-anchor="middle" font-family="Arial,sans-serif" font-size="35" fill="#26334b">${escapeXml(scene.title)}</text><rect x="70" y="1300" width="940" height="250" rx="38" fill="#26334b" opacity=".88"/>${captions}<text x="540" y="1770" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="#26334b">ESTÚDIO INFANTIL IA • ANIMATIC DEMONSTRATIVO</text></svg>`;
}
app.post("/api/projects/:id/render",async(req,res)=>{
 const p=getProject.get(req.params.id); if(!p) return res.status(404).json({error:"Projeto não encontrado."});
 const story=JSON.parse(p.data); const dir=path.join(PROJECTS,p.id);fs.mkdirSync(dir,{recursive:true});
 try{
  const max=Math.min(Number(process.env.MAX_VIDEO_SECONDS||90),90);
  if(story.duration>max) return res.status(400).json({error:`Duração máxima configurada: ${max}s.`});
  const framePaths=[];
  for(const scene of story.scenes){
   const out=path.join(dir,`scene-${scene.index}.png`);
   await sharp(Buffer.from(sceneSvg(story,scene))).png().toFile(out);framePaths.push(out);
  }
  const concat=path.join(dir,"frames.txt");
  let content="";
  story.scenes.forEach((s,i)=>{content+=`file '${framePaths[i].replace(/'/g,"'\\''")}'\nduration ${Math.max(1,s.end-s.start)}\n`;});
  content+=`file '${framePaths[framePaths.length-1].replace(/'/g,"'\\''")}'\n`;
  fs.writeFileSync(concat,content);
  const video=path.join(dir,"video.mp4");
  const ffmpeg=process.env.FFMPEG_PATH||"ffmpeg";
  await execFileAsync(ffmpeg,["-y","-f","concat","-safe","0","-i",concat,"-f","lavfi","-i","sine=frequency=440:sample_rate=44100:duration="+story.duration,"-vf","scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p","-r","24","-c:v","libx264","-preset","ultrafast","-t",String(story.duration),"-c:a","aac","-b:a","96k","-shortest",video],{timeout:240000,maxBuffer:1024*1024*10});
  story.render={kind:"animatic demonstrativo",warning:"Este MP4 contém ilustrações geradas pelo próprio aplicativo, legendas incorporadas e um tom de áudio de teste. Não contém vozes sintetizadas, música real nem animação de personagens. Conecte provedores de áudio/vídeo para produção final.",videoUrl:`/files/projects/${p.id}/video.mp4`,createdAt:new Date().toISOString()};
  updateProject.run("animatic gerado",JSON.stringify(story),story.render.videoUrl,p.id);
  res.json({ok:true,...story.render});
 }catch(e){
  updateProject.run("erro na renderização",JSON.stringify({...story,renderError:e.message}),null,p.id);
  res.status(500).json({error:"A renderização falhou. Verifique se o FFmpeg está instalado no servidor.",detail:e.message});
 }
});
app.get("/api/projects/:id/script.txt",(req,res)=>{
 const p=getProject.get(req.params.id);if(!p)return res.status(404).send("Projeto não encontrado");
 const d=JSON.parse(p.data);res.type("text/plain; charset=utf-8").attachment(`${p.id}-roteiro.txt`).send(`${d.title}\nTema: ${d.theme}\nFaixa etária: ${d.age}\nDuração: ${d.duration}s\n\n${d.scenes.map(s=>`CENA ${s.index} (${s.start}-${s.end}s) — ${s.title}\nFala: ${s.dialogue}\nVisual: ${s.visualPrompt}\n`).join("\n")}\nMúsica sugerida: ${d.lyrics}\n`);
});
app.get("/api/projects/:id/captions.srt",(req,res)=>{
 const p=getProject.get(req.params.id);if(!p)return res.status(404).send("Projeto não encontrado");
 const d=JSON.parse(p.data);const ts=n=>{const ms=Math.round(n*1000);return `${String(Math.floor(ms/3600000)).padStart(2,"0")}:${String(Math.floor(ms/60000)%60).padStart(2,"0")}:${String(Math.floor(ms/1000)%60).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`;};
 res.type("text/plain; charset=utf-8").attachment(`${p.id}-legendas.srt`).send(d.scenes.map((s,i)=>`${i+1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.dialogue}\n`).join("\n"));
});
app.get("*",(req,res)=>res.sendFile(path.join(ROOT,"public","index.html")));
app.listen(PORT,()=>console.log(`Estúdio Infantil IA disponível em http://localhost:${PORT}`));
