const $ = (id) => document.getElementById(id);
const CHECKER_API = "https://roblox-name-checker.miosillyfemboy.workers.dev";
const alphabet = "abcdefghijklmnopqrstuvwxyz";
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

  const maxUnique = Math.pow(alphabet.length, length) - excludedNames.size;
  if (maxUnique < count) throw new Error("No more unique usernames of this length are available.");
  let attempts = 0;
  while (names.size < count && attempts < count * 100) {
    attempts += 1;
    const candidate = randomName(length);
    if (!excludedNames.has(candidate)) names.add(candidate);
  }
  if (names.size < count) throw new Error("Could not generate another unique batch.");

  const list = $("results");
  list.replaceChildren();
  $("empty").hidden = true;

  names.forEach((username) => list.append(createIdea(username)));
  $("idea-count").textContent = names.size + " ideas";
  setNotice($("notice"), "Generated " + names.size + " ideas. Check individually or use Generate & auto-check.");
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
