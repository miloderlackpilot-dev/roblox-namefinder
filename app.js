const $ = (id) => document.getElementById(id);
const CHECKER_API = "https://roblox-name-checker.miosillyfemboy.workers.dev";
const alphabet = "abcdefghijklmnopqrstuvwxyz";
const CHECK_DELAY_MS = 2500;
let batchRunning = false;
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

function generateIdeas() {
  const length = Number($("length").value);
  const count = Number($("count").value);
  const names = new Set();

  while (names.size < count) names.add(randomName(length));

  const list = $("results");
  list.replaceChildren();
  $("empty").hidden = true;

  names.forEach((username) => list.append(createIdea(username)));
  $("idea-count").textContent = names.size + " ideas";
  setNotice($("notice"), "Generated " + names.size + " ideas. Check individually or use Generate & auto-check.");
}

$("generate").addEventListener("click", generateIdeas);

$("generate-check").addEventListener("click", async () => {
  if (batchRunning) return;

  generateIdeas();
  const items = Array.from($("results").children);
  const autoButton = $("generate-check");
  const generateButton = $("generate");
  const manualButton = $("manual-check");

  batchRunning = true;
  autoButton.disabled = true;
  generateButton.disabled = true;
  manualButton.disabled = true;
  items.forEach((item) => {
    item.querySelector(".idea-check").disabled = true;
  });

  let stoppedEarly = false;
  try {
    for (let index = 0; index < items.length; index += 1) {
      setNotice($("notice"), "Checking " + (index + 1) + " of " + items.length + "…");
      const result = await checkIdea(items[index]);

      if (result.status === "ratelimited" || result.status === "network-error" || result.status === "unknown") {
        stoppedEarly = true;
        for (let next = index + 1; next < items.length; next += 1) {
          items[next].querySelector(".idea-status").textContent = "Not checked";
        }
        break;
      }

      if (index < items.length - 1) await wait(CHECK_DELAY_MS);
    }

    if (!stoppedEarly) {
      setNotice($("notice"), "Batch check finished. Available* names still need confirmation on Roblox.", "good");
    }
  } catch (error) {
    stoppedEarly = true;
    setNotice($("notice"), "The batch stopped because an unexpected error occurred.", "error");
  } finally {
    batchRunning = false;
    autoButton.disabled = false;
    generateButton.disabled = false;
    manualButton.disabled = false;
    items.forEach((item) => {
      item.querySelector(".idea-check").disabled = false;
    });
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
