const $=id=>document.getElementById(id);
const CHECKER_API="https://roblox-name-checker.miosillyfemboy.workers.dev";
const alphabet="abcdefghijklmnopqrstuvwxyz";
const checkedNames=new Map();
function randomName(length){let s="";for(let i=0;i<length;i++)s+=alphabet[Math.floor(Math.random()*alphabet.length)];return s;}
function notice(el,msg,type=""){el.textContent=msg;el.className="notice "+type;}
async function validateUsername(username){
 if(CHECKER_API.includes("YOUR-WORKER-NAME"))return{status:"unknown",detail:"Checker server not connected yet. Follow README.md to deploy the Worker."};
 const response=await fetch(CHECKER_API,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({username})});
 if(response.status===429)return{status:"ratelimited"};
 if(!response.ok)return{status:"unknown",detail:"Checker returned HTTP "+response.status};
 const data=await response.json();
 return["available","taken","invalid","ratelimited"].includes(data.status)?data:{status:"unknown",detail:data.detail||"Could not verify this username."};
}
function makeIdea(name){
 const li=document.createElement("li");li.className="idea";
 const label=document.createElement("span");label.className="idea-name";label.textContent=name;
 const actions=document.createElement("div");actions.className="idea-actions";
 const status=document.createElement("span");status.className="idea-status";status.textContent=checkedNames.get(name)||"Not checked";
 if(status.textContent==="Available*")status.classList.add("good");
 const button=document.createElement("button");button.className="button secondary";button.textContent="Check";
 button.addEventListener("click",async()=>{
  button.disabled=true;status.textContent="Checking…";status.className="idea-status";
  try{
   const result=await validateUsername(name);
   const labels={available:["Available*","good"],taken:["Taken","bad"],invalid:["Invalid","bad"],ratelimited:["Rate limited","bad"],unknown:["Unconfirmed",""]};
   const [text,cls]=labels[result.status]||labels.unknown;status.textContent=text;status.className="idea-status "+cls;checkedNames.set(name,text);
   if(result.status==="available")notice($("notice"),name+" appears available. Confirm on Roblox before registering.","good");
   else if(result.status==="ratelimited")notice($("notice"),"Roblox is rate-limiting checks. Stop for now and try later.","error");
   else if(result.status==="unknown")notice($("notice"),result.detail||"Could not verify this username.","error");
   else notice($("notice"),name+" is "+result.status+".");
  }catch{status.textContent="Unconfirmed";notice($("notice"),"Could not reach the checker. Try again later.","error");}
  finally{button.disabled=false;}
 });
 actions.append(status,button);li.append(label,actions);return li;
}
function generate(){
 const length=Number($("length").value),count=Number($("count").value),names=new Set();
 while(names.size<count)names.add(randomName(length));
 const list=$("results");list.replaceChildren();$("empty").hidden=true;
 for(const name of names)list.append(makeIdea(name));
 $("idea-count").textContent=names.size+" ideas";
 notice($("notice"),"Generated "+names.size+" ideas. Check each name individually.");
}
$("generate").addEventListener("click",generate);
$("manual-check").addEventListener("click",async()=>{
 const name=$("manual-name").value.trim(),out=$("manual-result");
 if(!/^[a-zA-Z0-9_]{3,20}$/.test(name)){notice(out,"Enter 3 to 20 letters, numbers, or underscores.","error");return;}
 const btn=$("manual-check");btn.disabled=true;notice(out,"Checking with Roblox…");
 try{
  const r=await validateUsername(name);
  if(r.status==="available")notice(out,name+" appears available. Confirm on Roblox before registering.","good");
  else if(r.status==="taken")notice(out,name+" is already taken.","error");
  else if(r.status==="invalid")notice(out,name+" is invalid under Roblox's username rules.","error");
  else if(r.status==="ratelimited")notice(out,"Roblox is rate-limiting checks. Stop for now and try later.","error");
  else notice(out,r.detail||"Could not confirm this username.","error");
 }catch{notice(out,"Could not reach the checker. Try again later.","error");}
 finally{btn.disabled=false;}
});
$("manual-name").addEventListener("keydown",e=>{if(e.key==="Enter")$("manual-check").click();});
