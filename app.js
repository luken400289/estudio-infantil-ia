const $=id=>document.getElementById(id);
let currentProject=null, duration=60;
$("theme").addEventListener("change",()=>{$("customWrap").hidden=$("theme").value!=="Tema personalizado";});
document.querySelectorAll("#duration button").forEach(b=>b.addEventListener("click",()=>{duration=Number(b.dataset.value);document.querySelectorAll("#duration button").forEach(x=>x.classList.toggle("selected",x===b));}));
async function api(url,opts={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});let data;try{data=await r.json()}catch{data={error:"Resposta inválida do servidor."}}if(!r.ok)throw new Error(data.error||`Erro HTTP ${r.status}`);return data}
$("create").addEventListener("click",async()=>{
 const theme=$("theme").value;
 if(theme==="Tema personalizado"&&!$("customTheme").value.trim()){ $("status").textContent="Digite o tema personalizado.";return;}
 $("create").disabled=true;$("status").textContent="Criando roteiro e planejando as cenas…";
 try{
  currentProject=await api("/api/projects",{method:"POST",body:JSON.stringify({theme,customTheme:$("customTheme").value,age:$("age").value,style:$("style").value,duration,options:{music:$("music").checked,dialogue:$("dialogue").checked,narration:$("narration").checked}})});
  showProject(currentProject);$("status").textContent="Roteiro pronto! Revise as cenas abaixo.";await loadHistory();
 }catch(e){$("status").textContent=e.message}
 finally{$("create").disabled=false}
});
function showProject(p){
 $("result").hidden=false;$("resultTitle").textContent=p.title;$("resultMeta").textContent=`${p.theme} • ${p.age} • ${p.duration} segundos • ${p.mode}`;
 $("warning").hidden=!p.aiWarning;$("warning").textContent=p.aiWarning||"";
 $("scenes").innerHTML=p.scenes.map(s=>`<article class="scene"><div class="scene-head"><span class="scene-num">${s.index}</span><h3>${esc(s.title)}</h3><span class="time">${s.start}–${s.end}s</span></div><p><strong>Fala:</strong> ${esc(s.dialogue)}</p><p class="visual"><strong>Cena visual:</strong> ${esc(s.visualPrompt)}</p></article>`).join("");
 $("scriptLink").href=`/api/projects/${p.id}/script.txt`;$("srtLink").href=`/api/projects/${p.id}/captions.srt`;
 $("videoLink").hidden=true;$("renderStatus").textContent="";$("result").scrollIntoView({behavior:"smooth",block:"start"});
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("render").addEventListener("click",async()=>{
 if(!currentProject)return;$("render").disabled=true;$("renderStatus").textContent="Renderizando ilustrações e montando o MP4. Isso pode levar alguns minutos…";
 try{const r=await api(`/api/projects/${currentProject.id}/render`,{method:"POST",body:"{}"});$("videoLink").href=r.videoUrl;$("videoLink").hidden=false;$("videoLink").textContent="⬇️ Baixar MP4 demonstrativo";$("renderStatus").textContent=r.warning;await loadHistory()}
 catch(e){$("renderStatus").textContent=e.message}
 finally{$("render").disabled=false}
});
async function loadHistory(){try{const items=await api("/api/projects");$("history").innerHTML=items.length?items.map(p=>`<div class="history-item"><span>🎬</span><div><strong>${esc(p.title)}</strong><small>${esc(p.theme)} • ${new Date(p.created_at).toLocaleDateString("pt-BR")} • ${esc(p.status)}</small></div><button data-id="${esc(p.id)}">Abrir</button></div>`).join(""):'<p class="muted">Seus projetos aparecerão aqui.</p>';document.querySelectorAll(".history-item button").forEach(b=>b.addEventListener("click",async()=>{try{currentProject=await api(`/api/projects/${b.dataset.id}`);showProject({...currentProject,...currentProject.data});if(currentProject.video_path){$("videoLink").href=currentProject.video_path;$("videoLink").hidden=false}}catch(e){alert(e.message)}}))}catch{$("history").innerHTML='<p class="muted">Histórico indisponível no momento.</p>'}}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
loadHistory();
