const $ = (id) => document.getElementById(id);
const CHECKER_API = "https://roblox-name-checker.miosillyfemboy.workers.dev";
const alphabet = "abcdefghijklmnopqrstuvwxyz";
const realWords = {
  3: ["ace","air","ant","arc","ash","bay","bee","bet","bid","bit","bow","box","bud","bug","cap","cat","cob","cod","cup","cut","day","dew","dog","dot","dry","ear","eat","egg","elf","elk","end","eye","fan","far","fax","fig","fin","fit","fix","fly","fog","fox","fun","gap","gem","get","gum","gun","gut","ham","hat","hen","hey","hid","hit","hop","hot","hug","ice","ink","ivy","jam","jar","jet","job","joy","key","kid","kit","law","leg","let","lid","lie","lip","log","lot","low","map","mat","mix","mud","net","new","nod","not","oak","odd","off","oil","old","one","orb","owl","own","pan","paw","pay","pea","pen","pet","pie","pig","pin","pop","pot","ram","rap","raw","red","rib","rid","rim","rip","rob","rod","row","rub","rug","run","sad","sea","see","set","sew","sky","son","sun","tag","tan","tap","tea","ten","tie","tip","toe","top","toy","van","vet","via","war","wax","web","wet","win","wow","yak","yes","zip","zoo"],
  4: ["arch","aura","baby","back","bake","bald","bark","beam","bear","beat","bell","best","bird","blue","blur","boat","bold","bolt","bone","book","boom","born","bowl","calm","camp","cape","card","care","case","cash","cast","cave","chat","chef","chip","city","clay","clip","club","coal","coat","code","coil","cold","come","cook","cool","cope","core","corn","cove","crew","crop","cute","dawn","days","deer","desk","dial","dive","dock","dome","door","down","draw","drop","drum","dust","dusk","duty","each","earn","ease","east","easy","echo","edge","epic","even","ever","face","fact","fade","fair","fall","fame","farm","fast","fear","fern","fest","file","film","fire","fish","fizz","flag","flame","flat","flip","flow","flux","foam","fold","font","food","foot","fork","form","fort","free","frog","from","fuel","full","game","gate","gear","gem","gift","girl","give","glow","goal","goat","gold","good","gray","grew","grid","grin","grip","grow","gulf","guru","hair","half","hall","hand","hang","hard","hare","harm","haze","head","heal","heat","hero","hide","high","hill","hint","hold","hole","holy","home","hope","horn","host","hour","hush","icon","idea","iron","isle","jade","jazz","jeep","joke","jump","june","keen","keep","knot","lace","lake","lamp","land","last","late","leaf","lean","lens","life","lift","like","lily","lime","line","link","lion","list","live","load","loft","logo","long","look","loop","love","luck","luna","lush","made","maze","melt","mild","mile","milk","mint","mist","moon","more","moss","move","myth","navy","near","neon","nest","nice","nine","nova","ocean","opal","open","orca","over","pace","pack","page","pain","pair","palm","park","path","peak","pearl","pear","pine","pink","play","plum","poem","pond","pool","pure","quad","quiz","race","rain","rare","reef","rest","rice","rich","ride","ring","rise","risk","road","roar","rock","role","rose","ruby","rule","rush","safe","sage","sail","salt","sand","save","seal","seed","self","silk","sing","site","size","skin","sky","slim","slow","snow","soft","solo","song","star","stay","stem","step","surf","swan","swim","tale","task","team","teal","tech","tent","text","thin","tide","tile","time","tiny","tire","toad","told","tune","twin","type","unit","user","vale","vast","veil","very","vibe","view","vine","void","volt","vote","wade","wage","wake","walk","wall","warm","wave","wear","west","wide","wild","wind","wing","wise","wish","wolf","wood","word","work","yarn","year","yoga","zero","zone"]
};
const CHECK_DELAY_MS = 2500;
let batchRunning = false;
let stopRequested = false;
const checkedNames = new Map();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setNotice(element, message, type = "") {
  element.textContent = message;
  element.className = "notice " + type;
}

function randomName(length) {
  let name = "";
  for (let i = 0; i < length; i += 1) {
    name += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return name;
}

async function validateUsername(username) {
  const response = await fetch(CHECKER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ username })
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    return { status: "unknown", detail: "The checker returned an unreadable response." };
  }

  if (response.status === 429 || data.status === "ratelimited") {
    return { status: "ratelimited", detail: data.detail || "Roblox is rate-limiting checks." };
  }

  if (!response.ok) {
    return { status: "unknown", detail: data.detail || "Checker returned HTTP " + response.status };
  }

  if (["available", "taken", "invalid"].includes(data.status)) return data;
  return { status: "unknown", detail: data.detail || "Could not confirm availability." };
}

function showResult(statusElement, result) {
  const labels = {
    available: ["Available*", "good"],
    taken: ["Taken", "bad"],
    invalid: ["Invalid", "bad"],
    ratelimited: ["Rate limited", "bad"],
    unknown: ["Unconfirmed", ""]
  };
  const [label, className] = labels[result.status] || labels.unknown;
  statusElement.textContent = label;
  statusElement.className = "idea-status " + className;
  return label;
}

async function checkIdea(item) {
  const username = item.dataset.username;
  const status = item.querySelector(".idea-status");
  const checkButton = item.querySelector(".idea-check");

  checkButton.disabled = true;
  status.textContent = "Checking…";
  status.className = "idea-status";

  try {
    const result = await validateUsername(username);
    const label = showResult(status, result);
    checkedNames.set(username, label);

    if (result.status === "available") {
      setNotice($("notice"), username + " appears available. Confirm on Roblox before registering.", "good");
    } else if (result.status === "ratelimited") {
      setNotice($("notice"), "Roblox is rate-limiting checks. The batch has stopped.", "error");
    } else if (result.status === "unknown") {
      setNotice($("notice"), result.detail, "error");
    } else {
      setNotice($("notice"), username + " is " + result.status + ".");
    }
    return result;
  } catch (error) {
    status.textContent = "Unconfirmed";
    status.className = "idea-status";
    checkedNames.set(username, "Unconfirmed");
    setNotice($("notice"), "Could not connect to the checker. The batch has stopped.", "error");
    return { status: "network-error" };
  } finally {
    checkButton.disabled = batchRunning;
  }
}

function createIdea(username) {
  const item = document.createElement("li");
  item.className = "idea";
  item.dataset.username = username;

  const name = document.createElement("span");
  name.className = "idea-name";
  name.textContent = username;

  const actions = document.createElement("div");
  actions.className = "idea-actions";

  const status = document.createElement("span");
  status.className = "idea-status";
  status.textContent = checkedNames.get(username) || "Not checked";

  const checkButton = document.createElement("button");
  checkButton.type = "button";
  checkButton.className = "button secondary idea-check";
  checkButton.textContent = "Check";
  checkButton.addEventListener("click", () => {
    if (!batchRunning) checkIdea(item);
  });

  actions.append(status, checkButton);
  item.append(name, actions);
  return item;
}

function generateIdeas(excludedNames = new Set()) {
  const length = Number($("length").value);
  const count = Number($("count").value);
  const names = new Set();
  const mode = $("word-mode").value;

  if (mode === "words") {
    const availableWords = realWords[length].filter((word) => !excludedNames.has(word));
    if (availableWords.length < count) throw new Error("There are no more unused " + length + "-letter words for this search.");
    for (let i = availableWords.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableWords[i], availableWords[j]] = [availableWords[j], availableWords[i]];
    }
    availableWords.slice(0, count).forEach((word) => names.add(word));
  } else {
    const maxUnique = Math.pow(alphabet.length, length) - excludedNames.size;
    if (maxUnique < count) throw new Error("No more unique usernames of this length are available.");
    let attempts = 0;
    while (names.size < count && attempts < count * 100) {
      attempts += 1;
      const candidate = randomName(length);
      if (!excludedNames.has(candidate)) names.add(candidate);
    }
    if (names.size < count) throw new Error("Could not generate another unique batch.");
  }

  const list = $("results");
  list.replaceChildren();
  $("empty").hidden = true;

  names.forEach((username) => list.append(createIdea(username)));
  $("idea-count").textContent = names.size + " ideas";
  setNotice($("notice"), "Generated " + names.size + (mode === "words" ? " real words." : " random combinations.") + " Check individually or use Find an available name."");
}

$("generate").addEventListener("click", generateIdeas);

$("stop-check").addEventListener("click", () => {
  stopRequested = true;
  $("stop-check").disabled = true;
  setNotice($("notice"), "Stopping after the current username check finishes.");
});

$("generate-check").addEventListener("click", async () => {
  if (batchRunning) return;
  const autoButton = $("generate-check");
  const generateButton = $("generate");
  const manualButton = $("manual-check");
  const stopButton = $("stop-check");
  const notice = $("notice");
  const seenNames = new Set();
  let batchNumber = 0;
  let checkedTotal = 0;

  batchRunning = true;
  stopRequested = false;
  autoButton.disabled = true;
  generateButton.disabled = true;
  manualButton.disabled = true;
  stopButton.hidden = false;
  stopButton.disabled = false;
  autoButton.textContent = "Searching…";

  try {
    while (!stopRequested) {
      batchNumber += 1;
      generateIdeas(seenNames);
      const items = Array.from($("results").querySelectorAll(".idea"));
      items.forEach((item) => seenNames.add(item.dataset.username));

      for (let index = 0; index < items.length; index += 1) {
        if (stopRequested) break;
        const item = items[index];
        const username = item.dataset.username;
        const status = item.querySelector(".idea-status");
        status.textContent = "Checking…";
        status.className = "idea-status";
        setNotice(notice, "Batch " + batchNumber + ", checking " + (index + 1) + " of " + items.length + ": " + username);

        let result;
        try {
          result = await validateUsername(username);
        } catch (error) {
          result = { status: "network-error", detail: "Could not connect to the checker." };
        }

        if (result.status === "network-error" || result.status === "unknown" || result.status === "ratelimited") {
          status.textContent = result.status === "ratelimited" ? "Rate limited" : "Unconfirmed";
          status.className = "idea-status bad";
          setNotice(notice, result.detail || "The checker could not confirm the result. Search stopped.", "error");
          return;
        }

        const label = showResult(status, result);
        checkedNames.set(username, label);
        checkedTotal += 1;

        if (result.status === "available") {
          item.classList.add("idea-found");
          item.setAttribute("aria-label", username + " appears available");
          setNotice(notice, "Found a possible available username: " + username + ". Search stopped. Confirm it on Roblox.", "good");
          return;
        }
        if (index < items.length - 1 && !stopRequested) await wait(CHECK_DELAY_MS);
      }

      if (stopRequested) break;
      setNotice(notice, "Batch " + batchNumber + " complete. Automatically generating batch " + (batchNumber + 1) + ". " + checkedTotal + " checked so far.");
    }
    setNotice(notice, "Search stopped. " + checkedTotal + " usernames checked across " + batchNumber + " batches.");
  } catch (error) {
    setNotice(notice, error && error.message ? "Automatic search stopped: " + error.message : "The automatic search stopped because of an unexpected error.", "error");
  } finally {
    batchRunning = false;
    stopRequested = false;
    autoButton.disabled = false;
    generateButton.disabled = false;
    manualButton.disabled = false;
    stopButton.hidden = true;
    stopButton.disabled = false;
    autoButton.textContent = "Find an available name";
    document.querySelectorAll(".idea-check").forEach((button) => { button.disabled = false; });
  }
});

$("manual-check").addEventListener("click", async () => {
  const username = $("manual-name").value.trim();
  const output = $("manual-result");

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    setNotice(output, "Enter 3 to 20 letters, numbers, or underscores.", "error");
    return;
  }

  const button = $("manual-check");
  button.disabled = true;
  setNotice(output, "Checking with Roblox…");

  try {
    const result = await validateUsername(username);
    if (result.status === "available") {
      setNotice(output, username + " appears available. Confirm on Roblox before registering.", "good");
    } else if (result.status === "taken") {
      setNotice(output, username + " is already taken.", "error");
    } else if (result.status === "invalid") {
      setNotice(output, username + " is invalid under Roblox's username rules.", "error");
    } else {
      setNotice(output, result.detail || "Could not confirm this username.", "error");
    }
  } catch (error) {
    setNotice(output, "Could not reach the checker. Try again later.", "error");
  } finally {
    button.disabled = false;
  }
});

$("manual-name").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("manual-check").click();
});
