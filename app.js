const chatWindow = document.querySelector("#chatWindow");
const chatForm = document.querySelector("#chatForm");
const userInput = document.querySelector("#userInput");
const clearButton = document.querySelector("#clearButton");
const modelStatus = document.querySelector("#modelStatus");
const modelName = document.querySelector("#modelName");
const apiState = document.querySelector("#apiState");
const caseButtons = document.querySelectorAll(".case-button");
const apiKeyInput = document.querySelector("#apiKeyInput");
const saveKeyButton = document.querySelector("#saveKeyButton");
const forgetKeyButton = document.querySelector("#forgetKeyButton");
const toggleKeyButton = document.querySelector("#toggleKeyButton");

const API_KEY_STORAGE = "dashscope_api_key";
const MODEL = "qwen3.7-plus";
const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const messages = [];

const SYSTEM_PROMPT = `
你是“青少年网络使用风险评估与干预建议智能体”，面向心理辅导老师、班主任、家长和学生本人提供辅助分析。

你的任务：
1. 根据用户描述，识别网络使用风险、诱因、保护因素和需要继续了解的信息。
2. 以专业、克制、支持性的语气进行对话，不进行道德指责。
3. 输出结构化建议，包括：风险等级、主要观察、追问问题、干预建议、家庭/学校协作建议。
4. 当信息不足时，先追问关键问题，再给出暂定判断。
5. 遇到自伤、自杀、严重暴力、被虐待、急性精神危机等内容时，优先提示立即联系监护人、学校老师、当地急救或专业心理/精神卫生机构。

边界：
- 你不是医生，不能做医学诊断，不能替代心理咨询、精神科评估或紧急救助。
- 不要给出药物建议。
- 不要诱导用户透露姓名、电话、住址、学校等敏感身份信息。

输出格式尽量稳定：
【风险等级】
【关键依据】
【还需了解】
【干预建议】
【协作与转介】
【免责声明】
`.trim();

function normalizeApiKey(value) {
  return value.trim().replace(/\s+/g, "");
}

function isValidApiKey(value) {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

function loadSavedApiKey() {
  apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || "";
  updateKeyStatus();
}

function updateKeyStatus() {
  const hasKey = Boolean(normalizeApiKey(apiKeyInput.value));
  modelName.textContent = MODEL;
  modelStatus.textContent = hasKey ? "API Key 已就绪" : "等待 API Key";
  modelStatus.classList.toggle("ready", hasKey);
  apiState.textContent = hasKey ? "模型已准备" : "等待 API Key";
}

function appendMessage(role, content, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "我" : "助";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (options.error) bubble.classList.add("error");
  bubble.textContent = content;

  article.append(avatar, bubble);
  chatWindow.append(article);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return article;
}

function setBusy(isBusy) {
  const submit = chatForm.querySelector("button[type='submit']");
  submit.disabled = isBusy;
  submit.textContent = isBusy ? "分析中" : "发送评估";
}

function getApiKeyOrWarn() {
  const apiKey = normalizeApiKey(apiKeyInput.value);
  if (!apiKey) {
    appendMessage("assistant", "请先在右侧输入阿里云百炼 API Key，再发送评估。", { error: true });
    apiKeyInput.focus();
    return "";
  }
  if (!isValidApiKey(apiKey)) {
    appendMessage("assistant", "API Key 格式看起来不对。请只粘贴纯 Key，不要带中文说明、冒号或其他文字。", { error: true });
    apiKeyInput.focus();
    return "";
  }
  return apiKey;
}

async function callQwenDirect(apiKey) {
  const response = await fetch(DASHSCOPE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.35,
      top_p: 0.85
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text.slice(0, 600) || "千问接口调用失败");
  }
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || "模型没有返回有效内容。";
}

async function sendMessage(content) {
  const apiKey = getApiKeyOrWarn();
  if (!apiKey) return;

  messages.push({ role: "user", content });
  appendMessage("user", content);
  const loading = appendMessage("assistant", "正在结合风险评估要求生成建议...");
  setBusy(true);

  try {
    const answer = await callQwenDirect(apiKey);
    loading.remove();
    messages.push({ role: "assistant", content: answer });
    appendMessage("assistant", answer);
    modelStatus.textContent = MODEL;
    modelStatus.classList.add("ready");
  } catch (error) {
    loading.remove();
    const hint = String(error.message || "").includes("Failed to fetch")
      ? "调用失败：浏览器无法直连阿里云接口，可能是网络或 CORS 限制。若出现这种情况，只能改用 Node 后端部署。"
      : `调用失败：${error.message}`;
    appendMessage("assistant", hint, { error: true });
  } finally {
    setBusy(false);
    userInput.focus();
  }
}

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  const content = userInput.value.trim();
  if (!content) return;
  userInput.value = "";
  sendMessage(content);
});

clearButton.addEventListener("click", () => {
  messages.length = 0;
  chatWindow.innerHTML = "";
  appendMessage("assistant", "对话已清空。请重新描述一个青少年网络使用相关案例，我会按风险评估、追问、干预建议和转介边界进行分析。");
});

caseButtons.forEach(button => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.case;
    userInput.focus();
  });
});

apiKeyInput.addEventListener("input", updateKeyStatus);

saveKeyButton.addEventListener("click", () => {
  const apiKey = normalizeApiKey(apiKeyInput.value);
  if (!apiKey) {
    localStorage.removeItem(API_KEY_STORAGE);
    updateKeyStatus();
    return;
  }
  if (!isValidApiKey(apiKey)) {
    appendMessage("assistant", "API Key 格式看起来不对，暂不保存。请只粘贴纯 Key。", { error: true });
    return;
  }
  apiKeyInput.value = apiKey;
  localStorage.setItem(API_KEY_STORAGE, apiKey);
  updateKeyStatus();
  appendMessage("assistant", "API Key 已保存到当前浏览器本地。公共电脑上使用后请点击清除。");
});

forgetKeyButton.addEventListener("click", () => {
  apiKeyInput.value = "";
  localStorage.removeItem(API_KEY_STORAGE);
  updateKeyStatus();
  appendMessage("assistant", "已清除本机保存的 API Key。");
});

toggleKeyButton.addEventListener("click", () => {
  const showing = apiKeyInput.type === "text";
  apiKeyInput.type = showing ? "password" : "text";
  toggleKeyButton.setAttribute("aria-label", showing ? "显示 API Key" : "隐藏 API Key");
});

loadSavedApiKey();
