const $ = (id) => document.getElementById(id);
const CHECKER_API = "https://roblox-name-checker.miosillyfemboy.workers.dev";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const METRICS_API = CHECKER_API + "/metrics";
const REQUEST_TIMEOUT_MS = 15000;
const realWords = {
  3: ["ace","air","ant","arc","ash","bay","bee","bet","bid","bit","bow","box","bud","bug","cap","cat","cob","cod","cup","cut","day","dew","dog","dot","dry","ear","eat","egg","elf","elk","end","eye","fan","far","fax","fig","fin","fit","fix","fly","fog","fox","fun","gap","gem","get","gum","gun","gut","ham","hat","hen","hey","hid","hit","hop","hot","hug","ice","ink","ivy","jam","jar","jet","job","joy","key","kid","kit","law","leg","let","lid","lie","lip","log","lot","low","map","mat","mix","mud","net","new","nod","not","oak","odd","off","oil","old","one","orb","owl","own","pan","paw","pay","pea","pen","pet","pie","pig","pin","pop","pot","ram","rap","raw","red","rib","rid","rim","rip","rob","rod","row","rub","rug","run","sad","sea","see","set","sew","sky","son","sun","tag","tan","tap","tea","ten","tie","tip","toe","top","toy","van","vet","via","war","wax","web","wet","win","wow","yak","yes","zip","zoo"],
  4: ["arch","aura","baby","back","bake","bald","bark","beam","bear","beat","bell","best","bird","blue","blur","boat","bold","bolt","bone","book","boom","born","bowl","calm","camp","cape","card","care","case","cash","cast","cave","chat","chef","chip","city","clay","clip","club","coal","coat","code","coil","cold","come","cook","cool","cope","core","corn","cove","crew","crop","cute","dawn","days","deer","desk","dial","dive","dock","dome","door","down","draw","drop","drum","dust","dusk","duty","each","earn","ease","east","easy","echo","edge","epic","even","ever","face","fact","fade","fair","fall","fame","farm","fast","fear","fern","fest","file","film","fire","fish","fizz","flag","flame","flat","flip","flow","flux","foam","fold","font","food","foot","fork","form","fort","free","frog","from","fuel","full","game","gate","gear","gem","gift","girl","give","glow","goal","goat","gold","good","gray","grew","grid","grin","grip","grow","gulf","guru","hair","half","hall","hand","hang","hard","hare","harm","haze","head","heal","heat","hero","hide","high","hill","hint","hold","hole","holy","home","hope","horn","host","hour","hush","icon","idea","iron","isle","jade","jazz","jeep","joke","jump","june","keen","keep","knot","lace","lake","lamp","land","last","late","leaf","lean","lens","life","lift","like","lily","lime","line","link","lion","list","live","load","loft","logo","long","look","loop","love","luck","luna","lush","made","maze","melt","mild","mile","milk","mint","mist","moon","more","moss","move","myth","navy","near","neon","nest","nice","nine","nova","ocean","opal","open","orca","over","pace","pack","page","pain","pair","palm","park","path","peak","pearl","pear","pine","pink","play","plum","poem","pond","pool","pure","quad","quiz","race","rain","rare","reef","rest","rice","rich","ride","ring","rise","risk","road","roar","rock","role","rose","ruby","rule","rush","safe","sage","sail","salt","sand","save","seal","seed","self","silk","sing","site","size","skin","sky","slim","slow","snow","soft","solo","song","star","stay","stem","step","surf","swan","swim","tale","task","team","teal","tech","tent","text","thin","tide","tile","time","tiny","tire","toad","told","tune","twin","type","unit","user","vale","vast","veil","very","vibe","view","vine","void","volt","vote","wade","wage","wake","walk","wall","warm","wave","wear","west","wide","wild","wind","wing","wise","wish","wolf","wood","word","work","yarn","year","yoga","zero","zone"]
};

let searchRunning = false;
let stopRequested = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setNotice(element, message, type = "") {
  element.textContent = message;
  element.className = "notice" + (type ? " " + type : "");
}

function getSettings() {
  const length = Number($("length").value);
  const count = Number($("count").value);
  const mode = $("word-mode").value;
  if (![3, 4].includes(length)) throw new Error("Choose a 3-letter or 4-letter length.");
  if (![8, 12, 20].includes(count)) throw new Error("Choose a valid batch size.");
  if (!["random", "words"].includes(mode)) throw new Error("Choose a valid name style.");
  return { length, count, mode };
}

function randomName(length) {
  let name = "";
  for (let i = 0; i < length; i += 1) {
    name += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return name;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function generateBatch(settings, excluded = new Set()) {
  const { length, count, mode } = settings;
  const names = [];

  if (mode === "words") {
    const pool = [...new Set(realWords[length])]
      .filter((word) => word.length === length && !excluded.has(word));
    if (pool.length < count) {
      throw new Error("All available " + length + "-letter words in the word list have been checked.");
    }
    return shuffle(pool).slice(0, count);
  }

  const totalPossible = Math.pow(ALPHABET.length, length);
  if (excluded.size >= totalPossible) {
    throw new Error("Every possible " + length + "-letter combination has been checked.");
  }

  const batch = new Set();
  let attempts = 0;
  const attemptLimit = count * 1000;
  while (batch.size < count && attempts < attemptLimit) {
    attempts += 1;
    const candidate = randomName(length);
    if (!excluded.has(candidate)) batch.add(candidate);
  }

  // For the small 3-letter space, fall back to a complete scan near exhaustion.
  if (batch.size < count) {
    const scan = (prefix, remaining) => {
      if (batch.size >= count) return;
      if (remaining === 0) {
        if (!excluded.has(prefix)) batch.add(prefix);
        return;
      }
      for (const letter of ALPHABET) {
        if (batch.size >= count) return;
        scan(prefix + letter, remaining - 1);
      }
    };
    scan("", length);
  }

  if (batch.size < count) {
    throw new Error("Not enough unchecked combinations remain to create another batch.");
  }
  names.push(...batch);
  return names;
}

async function validateUsername(username) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CHECKER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ username }),
      signal: controller.signal
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return { status: "unknown", detail: "The checker returned an invalid response." };
    }

    if (response.status === 429 || data.status === "ratelimited") {
      return { status: "ratelimited", detail: data.detail || "Roblox is rate-limiting requests." };
    }
    if (!response.ok) {
      return { status: "unknown", detail: data.detail || "The checker returned HTTP " + response.status + "." };
    }
    if (["available", "taken", "invalid"].includes(data.status)) return data;
    return { status: "unknown", detail: data.detail || "Roblox did not confirm this username." };
  } catch (error) {
    if (error.name === "AbortError") {
      return { status: "unknown", detail: "The check timed out. Search paused to avoid sending duplicate requests." };
    }
    return { status: "unknown", detail: "Could not connect to the checker. Check your connection and try again." };
  } finally {
    clearTimeout(timeout);
  }
}

function statusLabel(result) {
  const labels = {
    available: ["Available*", "good"],
    taken: ["Taken", "bad"],
    invalid: ["Invalid", "bad"],
    ratelimited: ["Rate limited", "bad"],
    unknown: ["Unconfirmed", ""]
  };
  return labels[result.status] || labels.unknown;
}

function renderIdeas(names) {
  const list = $("results");
  const fragment = document.createDocumentFragment();

  names.forEach((username) => {
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
    status.textContent = "Not checked";

    const checkButton = document.createElement("button");
    checkButton.type = "button";
    checkButton.className = "button secondary idea-check";
    checkButton.textContent = "Check";
    checkButton.addEventListener("click", () => checkSingleIdea(item));

    actions.append(status, checkButton);
    item.append(name, actions);
    fragment.append(item);
  });

  list.replaceChildren(fragment);
  $("empty").hidden = names.length > 0;
  $("idea-count").textContent = names.length + (names.length === 1 ? " idea" : " ideas");
}

async function checkSingleIdea(item) {
  if (searchRunning) return;
  const button = item.querySelector(".idea-check");
  const status = item.querySelector(".idea-status");
  button.disabled = true;
  status.textContent = "Checking…";
  status.className = "idea-status";

  const result = await validateUsername(item.dataset.username);
  const [label, className] = statusLabel(result);
  status.textContent = label;
  status.className = "idea-status" + (className ? " " + className : "");

  if (result.status === "available") {
    item.classList.add("idea-found");
    setNotice($("notice"), item.dataset.username + " appears available. Confirm on Roblox before registering.", "good");
  } else if (result.status === "taken" || result.status === "invalid") {
    setNotice($("notice"), item.dataset.username + " is " + result.status + ".");
  } else {
    setNotice($("notice"), result.detail, "error");
  }
  button.disabled = false;
}

function generateAndRender(excluded = new Set()) {
  const settings = getSettings();
  const names = generateBatch(settings, excluded);
  renderIdeas(names);
  setNotice($("notice"), "Generated " + names.length + (settings.mode === "words" ? " real words." : " random letter combinations."));
  return names;
}

function setSearchControls(disabled) {
  $("generate").disabled = disabled;
  $("generate-check").disabled = disabled;
  $("manual-check").disabled = disabled;
  $("length").disabled = disabled;
  $("count").disabled = disabled;
  $("word-mode").disabled = disabled;
  document.querySelectorAll(".idea-check").forEach((button) => {
    button.disabled = disabled;
  });
  $("stop-check").hidden = !disabled;
  $("stop-check").disabled = false;
  $("generate-check").textContent = disabled ? "Searching…" : "Find an available name";
}

$("generate").addEventListener("click", () => {
  if (searchRunning) return;
  try {
    generateAndRender();
  } catch (error) {
    setNotice($("notice"), error.message || "Could not generate names.", "error");
  }
});

$("stop-check").addEventListener("click", () => {
  if (!searchRunning) return;
  stopRequested = true;
  $("stop-check").disabled = true;
  setNotice($("notice"), "Stopping after the current check finishes.");
});

$("generate-check").addEventListener("click", async () => {
  if (searchRunning) return;

  let settings;
  try {
    settings = getSettings();
  } catch (error) {
    setNotice($("notice"), error.message, "error");
    return;
  }

  searchRunning = true;
  stopRequested = false;
  setSearchControls(true);

  const seenNames = new Set();
  let checkedTotal = 0;
  let batchNumber = 0;

  try {
    while (!stopRequested) {
      batchNumber += 1;
      const names = generateBatch(settings, seenNames);
      names.forEach((name) => seenNames.add(name));
      renderIdeas(names);

      for (let index = 0; index < names.length; index += 1) {
        if (stopRequested) break;

        const username = names[index];
        const item = $("results").querySelector('[data-username="' + username + '"]');
        const status = item.querySelector(".idea-status");
        status.textContent = "Checking…";
        status.className = "idea-status";
        setNotice($("notice"), "Batch " + batchNumber + ". Checking " + (index + 1) + " of " + names.length + ": " + username);

        const result = await validateUsername(username);
        const [label, className] = statusLabel(result);
        status.textContent = label;
        status.className = "idea-status" + (className ? " " + className : "");

        if (result.status === "unknown" || result.status === "ratelimited") {
          setNotice($("notice"), result.detail + " Automatic search paused. You can try again later.", "error");
          return;
        }

        checkedTotal += 1;
        if (result.status === "available") {
          item.classList.add("idea-found");
          item.setAttribute("aria-label", username + " appears available");
          setNotice($("notice"), "Found a possible available username: " + username + ". Search stopped. Confirm it on Roblox.", "good");
          return;
        }

      }

      if (stopRequested) break;
      setNotice($("notice"), "Batch " + batchNumber + " complete. Starting batch " + (batchNumber + 1) + ". " + checkedTotal + " checked so far.");
    }

    setNotice($("notice"), "Search stopped. " + checkedTotal + " usernames checked across " + batchNumber + " batches.");
  } catch (error) {
    setNotice($("notice"), error.message || "Automatic search stopped because of an unexpected error.", "error");
  } finally {
    searchRunning = false;
    stopRequested = false;
    setSearchControls(false);
  }
});

$("manual-check").addEventListener("click", async () => {
  if (searchRunning) return;
  const username = $("manual-name").value.trim();
  const output = $("manual-result");

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    setNotice(output, "Enter 3 to 20 letters, numbers, or underscores.", "error");
    return;
  }

  const button = $("manual-check");
  button.disabled = true;
  setNotice(output, "Checking with Roblox…");

  const result = await validateUsername(username);
  if (result.status === "available") {
    setNotice(output, username + " appears available. Confirm on Roblox before registering.", "good");
  } else if (result.status === "taken") {
    setNotice(output, username + " is already taken.", "error");
  } else if (result.status === "invalid") {
    setNotice(output, username + " is invalid under Roblox's username rules.", "error");
  } else {
    setNotice(output, result.detail, "error");
  }
  button.disabled = false;
});

$("manual-name").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("manual-check").click();
});


function formatRate(value) {
  return Number(value || 0).toFixed(1);
}

async function refreshRateDashboard() {
  try {
    const response = await fetch(METRICS_API, { headers: { "Accept": "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Metrics endpoint returned HTTP " + response.status);
    const data = await response.json();
    $("site-rate").textContent = formatRate(data.websiteRequestsPerMinute);
    $("roblox-rate").textContent = formatRate(data.robloxChecksPerMinute);
    $("target-rate").textContent = String(data.targetChecksPerMinute || 0);
    $("total-checked").textContent = String(data.robloxChecksTotal || 0);
    $("rate-limited").textContent = String(data.rateLimited || 0);
    $("rate-errors").textContent = String(data.errors || 0);
    const cooldown = Number(data.cooldownUntil || 0) - Date.now();
    $("rate-state").textContent = cooldown > 0
      ? "Cooling down for " + Math.ceil(cooldown / 1000) + "s"
      : data.lastStatus || "Waiting for checks";
    $("rate-interval").textContent = (Number(data.intervalMs || 2500) / 1000).toFixed(2) + "s between checks";
    $("rate-updated").textContent = "Updated " + new Date(data.updatedAt || Date.now()).toLocaleTimeString();
  } catch {
    $("rate-state").textContent = "Metrics unavailable. Deploy the updated Worker and Durable Object.";
    $("site-rate").textContent = "—";
    $("roblox-rate").textContent = "—";
  }
}

refreshRateDashboard();
setInterval(refreshRateDashboard, 5000);
