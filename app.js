const $ = (id) => document.getElementById(id);
const alphabet = "abcdefghijklmnopqrstuvwxyz";
const STORAGE_KEY = "roblox-namefinder-v1";
// Set this to your deployed Cloudflare Worker URL after creating the Worker.
const CHECKER_API = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev";
let state = loadState();
let running = false;
let pauseRequested = false;
let candidates = [];
let cursor = 0;
let startedAt = 0;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {checked:0,available:[],taken:0,unknown:0,seed:null,cursor:0,length:"both"};
  } catch {
    return {checked:0,available:[],taken:0,unknown:0,seed:null,cursor:0,length:"both"};
  }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { setNotice("Browser storage is full. Export your results before continuing.", "error"); }
}
function setNotice(message, type="") {
  $("notice").textContent = message;
  $("notice").className = "notice " + type;
}
function randSeed() { return Math.floor(Math.random() * 0x7fffffff) || 1; }
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function makeCandidates(lengthMode, seed) {
  const lengths = lengthMode === "both" ? [3,4] : [Number(lengthMode)];
  const list = [];
  for (const len of lengths) {
    const total = 26 ** len;
    for (let n=0; n<total; n++) {
      let x=n, word="";
      for(let p=0;p<len;p++){word=alphabet[x%26]+word;x=Math.floor(x/26);}
      list.push(word);
    }
  }
  const random = seededRandom(seed);
  for(let i=list.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [list[i],list[j]]=[list[j],list[i]];
  }
  return list;
}
function updateUI() {
  $("checked").textContent = state.checked.toLocaleString();
  $("available").textContent = state.available.length.toLocaleString();
  $("taken").textContent = state.taken.toLocaleString();
  $("unknown").textContent = state.unknown.toLocaleString();
  $("results").innerHTML = "";
  $("empty").hidden = state.available.length > 0;
  for(const name of state.available.slice(-100).reverse()) {
    const li=document.createElement("li"); li.className="result";
    const span=document.createElement("span"); span.className="result-name"; span.textContent=name;
    const button=document.createElement("button"); button.className="copy"; button.textContent="COPY";
    button.addEventListener("click", async()=>{try{await navigator.clipboard.writeText(name);button.textContent="COPIED";setTimeout(()=>button.textContent="COPY",1000);}catch{setNotice("Clipboard access was blocked by this browser.","error");}});
    li.append(span,button); $("results").append(li);
  }
  const total = candidates.length || (state.length === "3" ? 17576 : state.length === "4" ? 456976 : 474552);
  const pct = total ? Math.min(100, state.cursor/total*100) : 0;
  $("percent").textContent = pct.toFixed(1)+"%";
  $("progress").style.width = pct+"%";
  $("progress-label").textContent = state.cursor.toLocaleString()+" of "+total.toLocaleString()+" candidates traversed";
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function validateUsername(username) {
  if(CHECKER_API.includes("YOUR-WORKER-NAME")) {
    return {status:"unknown",detail:"The Cloudflare Worker has not been connected yet. Follow the setup steps in README.md."};
  }
  const response = await fetch(CHECKER_API, {
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({username})
  });
  if(response.status===429) return {status:"ratelimited"};
  if(!response.ok) return {status:"unknown",detail:"Checker server returned HTTP "+response.status};
  const data=await response.json();
  if(data.status==="available" || data.status==="taken" || data.status==="invalid" || data.status==="ratelimited") return data;
  return {status:"unknown",detail:data.detail||"Unrecognized checker response"};
}
async function startScan() {
  if(running) return;
  const limit=Math.max(1,Math.min(5000,Number($("limit").value)||50));
  const length=$("length").value;
  const delay=Number($("delay").value);
  if(!state.seed || state.length!==length || state.cursor===0) {
    state={checked:0,available:[],taken:0,unknown:0,seed:randSeed(),cursor:0,length};
  }
  candidates=makeCandidates(length,state.seed);
  cursor=state.cursor;
  if(cursor>=candidates.length){setNotice("This candidate set is complete. Reset progress to start a new shuffled search.","good");return;}
  running=true;pauseRequested=false;startedAt=Date.now();
  $("start").disabled=true;$("pause").disabled=false;$("pause").textContent="Pause";$("manual-check").disabled=true;
  setNotice("Scanning sequentially. If Roblox or your browser blocks the request, the result will be marked unconfirmed.","");
  let processed=0;
  while(running && !pauseRequested && cursor<candidates.length && processed<limit) {
    const username=candidates[cursor];
    try {
      const result=await validateUsername(username);
      if(result.status==="ratelimited") {
        setNotice("Roblox returned a rate-limit response. The scan has stopped. Wait before trying again.","error");
        state.unknown++;state.checked++;cursor++;state.cursor=cursor;break;
      }
      if(result.status==="available") state.available.push(username);
      else if(result.status==="taken" || result.status==="invalid") state.taken++;
      else state.unknown++;
    } catch(error) {
      state.unknown++;
      setNotice("The request could not be completed. Your browser may block direct Roblox API access (CORS or network policy). No availability was assumed.","error");
      state.checked++;cursor++;state.cursor=cursor;saveState();updateUI();break;
    }
    state.checked++;cursor++;processed++;state.cursor=cursor;
    saveState();updateUI();
    const elapsed=(Date.now()-startedAt)/1000;
    $("eta").textContent=processed>0 ? "This run: "+Math.round(elapsed/processed*(Math.min(limit,candidates.length-cursor))).toLocaleString()+"s estimated" : "Calculating";
    if(cursor<candidates.length && processed<limit && !pauseRequested) await wait(delay);
  }
  running=false;$("start").disabled=false;$("pause").disabled=true;$("pause").textContent="Pause";$("manual-check").disabled=false;
  if(pauseRequested) setNotice("Paused. Your progress is saved in this browser.","good");
  else if(cursor>=candidates.length) setNotice("All candidates in this length selection have been traversed.","good");
  else if(processed>=limit) setNotice("Run complete. Progress saved. Start again to continue from the next candidate.","good");
  saveState();updateUI();
}
$("start").addEventListener("click",startScan);
$("manual-check").addEventListener("click", async()=>{
  if(running)return;
  const username=$("manual-name").value.trim();
  const output=$("manual-result");
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username)){
    output.textContent="Enter 3 to 20 letters, numbers, or underscores.";
    output.className="notice error";
    return;
  }
  const button=$("manual-check");
  button.disabled=true;
  output.textContent="Checking with Roblox...";
  output.className="notice";
  try{
    const result=await validateUsername(username);
    if(result.status==="available"){
      output.textContent=username+" appears available right now. Confirm again on Roblox before registering.";
      output.className="notice good";
    }else if(result.status==="taken"){
      output.textContent=username+" is already taken.";
      output.className="notice error";
    }else if(result.status==="invalid"){
      output.textContent=username+" is not valid under Roblox's username rules.";
      output.className="notice error";
    }else if(result.status==="ratelimited"){
      output.textContent="Roblox rate-limited the request. Wait before checking again.";
      output.className="notice error";
    }else{
      output.textContent="Could not confirm this username. "+(result.detail||"Try again later.");
      output.className="notice error";
    }
  }catch{
    output.textContent="Request failed. Your browser or network may block direct Roblox API access.";
    output.className="notice error";
  }finally{button.disabled=false;}
});
$("pause").addEventListener("click",()=>{pauseRequested=true;$("pause").disabled=true;});
$("reset").addEventListener("click",()=>{
  if(running)return;
  if(!confirm("Reset all scan progress and saved results in this browser?"))return;
  state={checked:0,available:[],taken:0,unknown:0,seed:null,cursor:0,length:$("length").value};
  candidates=[];saveState();updateUI();$("eta").textContent="No estimate yet";setNotice("Progress reset.");
});
$("length").addEventListener("change",()=>{
  if(running)return;
  state={checked:0,available:[],taken:0,unknown:0,seed:null,cursor:0,length:$("length").value};
  candidates=[];saveState();updateUI();$("eta").textContent="No estimate yet";setNotice("Length changed. A new shuffled search is ready.");
});
$("export").addEventListener("click",()=>{
  if(!state.available.length){setNotice("There are no confirmed available names to export.");return;}
  const blob=new Blob([state.available.join("\n")+"\n"],{type:"text/plain"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download="available-roblox-usernames.txt";a.click();URL.revokeObjectURL(url);
});
if(state.seed && state.length) $("length").value=state.length;
updateUI();
