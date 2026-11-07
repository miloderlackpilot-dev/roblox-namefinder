const $=id=>document.getElementById(id);
const CHECKER_API="https://roblox-name-checker.miosillyfemboy.workers.dev";
const alphabet="abcdefghijklmnopqrstuvwxyz";
const checkedNames=new Map();
const CHECK_DELAY_MS=2500;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function randomName(length){let s="";for(let i=0;i<length;i++)s+=alphabet[Math.floor(Math.random()*alphabet.length)];return s;}
function notice(el,msg,type=""){el.textContent=msg;el.className="notice "+type;}
async function validateUsername(username){
 const response=await fetch(CHECKER_API,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({username})});
 if(response.status===429)return{status:"ratelimited"};
 if(!response.ok)return{status:"unknown",detail:"Checker returned HTTP "+response.status};
 const data=await response.json();
 return["available","taken","invalid","ratelimited"].includes(data.status)?data:{status:"unknown",detail:data.detail||"Could not verify this username."};
}
function applyResult(status,result){
 const labels={available:["Available*","good"],taken:["Taken","bad"],invalid:["Invalid","bad"],ratelimited:["Rate limited","bad"],unknown:["Unconfirmed",""]};
 const [label,style]=labels[result.status]||labels.unknown;
 status.textContent=label;status.className="idea-status "+style;
 return label;
}
function makeIdea(name){
 const li=document.createElement("li");li.className="idea";
 const label=document.createElement("span");label.className="idea-name";label.textContent=name;
 const actions=document.createElement("div");actions.className="idea-actions";
 const status=document.createElement("span");status.className="idea-status";status.textContent=checkedNames.get(name)||"Not checked";
 if(status.textContent==="Available*")status.classList.add("good");
 const button=document.createElement("button");button.className="button secondary";button.textContent="Check";
 const runCheck=async()=>{
  button.disabled=true;status.textContent="Checking…";status.className="idea-status";
  try{
   const result=await validateUsername(name);
   const labelText=applyResult(status,result);checkedNames.set(name,labelText);
   if(result.status==="available")notice($("notice"),name+" appears available. Confirm on Roblox before registering.","good");
   else if(result.status==="ratelimited")notice($("notice"),"Roblox is rate-limiting checks. Automatic checking has stopped. Try again later.","error");
   else if(result.status==="unknown")notice($("notice"),result.detail||"Could not verify this username.","error");
   else notice($("notice"),name+" is "+result.status+".");
   return result;
  }catch{
   status.textContent="Unconfirmed";status.className="idea-status";checkedNames.set(name,"Unconfirmed");
   notice($("notice"),"Could not reach the checker. Automatic checking has stopped.","error");
   return{status:"network-error"};
  }finally{button.disabled=false;}
 };
 button.addEventListener("click",runCheck);
 li.append(label,actions);actions.append(status,button);
 li.runCheck=runCheck;li.checkButton=button;
 return li;
}
function generate(){
 const length=Number($("length").value),count=Number($("count").value),names=new Set();
 while(names.size<count)names.add(randomName(length));
 const list=$("results");list.replaceChildren();$("empty").hidden=true;
 for(const name of names)list.append(makeIdea(name));
 $("idea-count").textContent=names.size+" ideas";
 notice($("notice"),"Generated "+names.size+" ideas. Choose an individual check or auto-check this batch.");
}
$("generate").addEventListener("click",generate);
$("generate-check").addEventListener("click",async()=>{
 generate();
 const button=$("generate-check"),generateButton=$("generate");
 const items=[...$("results").children];
 button.disabled=true;generateButton.disabled=true;
 for(let i=0;i<items.length;i++){
  notice($("notice"),"Checking "+(i+1)+" of "+items.length+". One request every 2.5 seconds.");
  const result=await items[i].runCheck();
  if(result.status==="ratelimited"||result.status==="network-error"){
   for(let j=i+1;j<items.length;j++){
    items[j].querySelector(".idea-status").textContent="Not checked";
   }
   break;
  }
  if(i<items.length-1)await wait(CHECK_DELAY_MS);
 }
 const rateStopped=[...items].some(item=>item.querySelector(".idea-status").textContent==="Rate limited");
 if(!rateStopped)notice($("notice"),"Batch check finished. Available* names still need confirmation on Roblox.","good");
 button.disabled=false;generateButton.disabled=false;
});
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
