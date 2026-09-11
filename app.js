const messagesElement = document.querySelector('#messages');
const modelElement = document.querySelector('#model');
const promptElement = document.querySelector('#prompt');
const sendElement = document.querySelector('#send');
const statusElement = document.querySelector('#status');
const reasoningElement = document.querySelector('#reasoning');
const answerStyleElement = document.querySelector('#answer-style');
const clearElement = document.querySelector('#clear');
const historyNoticeElement = document.querySelector('#history-notice');

const storageKey = 'chat-lite-for-ollama:v1';
const legacyStorageKey = 'ollama-chat-ui';
const answerStyleInstructions = {
  concise: 'Give a concise, direct answer. Prefer a few short paragraphs and include only the most relevant details.',
  balanced: 'Give a clear answer with moderate detail. Explain the important points without unnecessary repetition.',
  detailed: 'Give a thorough, well-structured answer. Include useful explanations, examples, and relevant caveats.'
};

let messages = [];
let generating = false;
let thinkingMode = 'none';
let activeRequestController = null;
let pendingMessageFrame = null;
let thinkingRequestVersion = 0;

function loadHistory() {
  try {
    const currentHistory = localStorage.getItem(storageKey);
    const serialized = currentHistory ?? localStorage.getItem(legacyStorageKey) ?? '{}';
    const saved = JSON.parse(serialized);
    messages = Array.isArray(saved.messages)
      ? saved.messages
          .filter(message => message
            && ['user', 'assistant'].includes(message.role)
            && typeof message.content === 'string')
          .map(message => ({
            role: message.role,
            content: message.content,
            thinking: typeof message.thinking === 'string' ? message.thinking : '',
            model: typeof message.model === 'string' ? message.model : '',
            failed: message.failed === true
          }))
      : [];

    const savedReasoning = saved.reasoning === true ? 'true' : saved.reasoning;
    reasoningElement.dataset.preference = ['false', 'true', 'low', 'medium', 'high'].includes(savedReasoning)
      ? savedReasoning
      : 'false';
    answerStyleElement.value = ['concise', 'balanced', 'detailed'].includes(saved.answerStyle)
      ? saved.answerStyle
      : 'balanced';
    return typeof saved.model === 'string' ? saved.model : '';
  } catch {
    messages = [];
    historyNoticeElement.textContent = 'Browser history is unavailable. This chat will still work for the current session.';
    return '';
  }
}

function saveHistory() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      model: modelElement.value,
      reasoning: reasoningElement.value,
      answerStyle: answerStyleElement.value,
      messages
    }));
    historyNoticeElement.textContent = '';
    return true;
  } catch {
    historyNoticeElement.textContent = 'Chat history could not be saved. This chat will still work for the current session.';
    return false;
  }
}

function getThinkingParagraphs(thinking) {
  return thinking
    .trim()
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

function modelUsesEffortLevels(modelName) {
  const modelBase = modelName.toLowerCase().split(':')[0].split('/').pop();
  return modelBase === 'gpt-oss';
}

function configureReasoningOptions(preference = reasoningElement.dataset.preference || 'false') {
  let options;
  if (thinkingMode === 'levels') {
    options = [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ];
  } else if (thinkingMode === 'toggle') {
    options = [
      { value: 'false', label: 'Off' },
      { value: 'true', label: 'On' }
    ];
  } else {
    options = [{ value: 'false', label: 'Off' }];
  }

  reasoningElement.replaceChildren();
  for (const item of options) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    reasoningElement.append(option);
  }

  if (thinkingMode === 'levels') {
    reasoningElement.value = ['low', 'medium', 'high'].includes(preference) ? preference : 'medium';
  } else if (thinkingMode === 'toggle') {
    reasoningElement.value = ['true', 'low', 'medium', 'high'].includes(preference) ? 'true' : 'false';
  } else {
    reasoningElement.value = 'false';
  }
  reasoningElement.dataset.preference = reasoningElement.value;
}

function getThinkValue() {
  if (thinkingMode === 'levels') return reasoningElement.value;
  if (thinkingMode === 'toggle') return reasoningElement.value === 'true';
  return false;
}

function createEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty';
  const body = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = 'Chat with your local models';
  body.append(heading, document.createTextNode('Select a model and send a message. Responses stay between this browser and your Ollama server.'));
  empty.append(body);
  return empty;
}

function createMessageElement(message, index) {
  const article = document.createElement('article');
  article.className = `message ${message.role}`;
  article.dataset.messageIndex = String(index);

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = message.role === 'assistant' ? 'AI' : 'YOU';

  const body = document.createElement('div');
  const role = document.createElement('div');
  role.className = 'role';

  const thinkingPanel = document.createElement('details');
  thinkingPanel.className = 'thinking-panel';
  thinkingPanel.hidden = true;
  const thinkingSummary = document.createElement('summary');
  const thinkingContent = document.createElement('div');
  thinkingContent.className = 'thinking-content';
  thinkingPanel.append(thinkingSummary, thinkingContent);

  const content = document.createElement('div');
  content.className = 'content';
  body.append(role, thinkingPanel, content);
  article.append(avatar, body);
  updateMessageElement(article, message, index);
  return article;
}

function updateMessageElement(article, message, index) {
  article.querySelector('.role').textContent = message.role === 'assistant' ? message.model || 'Ollama' : 'You';

  const thinkingPanel = article.querySelector('.thinking-panel');
  const hadThinking = !thinkingPanel.hidden;
  thinkingPanel.hidden = !message.thinking;
  if (message.thinking) {
    if (!hadThinking) thinkingPanel.open = true;
    thinkingPanel.querySelector('summary').textContent = generating && index === messages.length - 1
      ? 'Reasoning live'
      : 'Reasoning';
    const thinkingContent = thinkingPanel.querySelector('.thinking-content');
    const paragraphs = getThinkingParagraphs(message.thinking).map(paragraph => {
      const paragraphElement = document.createElement('p');
      paragraphElement.textContent = paragraph;
      return paragraphElement;
    });
    thinkingContent.replaceChildren(...paragraphs);
    if (thinkingPanel.open) thinkingContent.scrollTop = thinkingContent.scrollHeight;
  }

  const content = article.querySelector('.content');
  content.hidden = Boolean(message.thinking && !message.content);
  content.classList.toggle('error', message.failed === true);
  content.textContent = message.content || (generating ? 'Thinking…' : '');
}

function isNearConversationEnd() {
  return messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight < 80;
}

function scrollConversationToEnd() {
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function render({ scrollToEnd = false } = {}) {
  messagesElement.replaceChildren();
  if (messages.length === 0) {
    messagesElement.append(createEmptyState());
  } else {
    const fragment = document.createDocumentFragment();
    messages.forEach((message, index) => fragment.append(createMessageElement(message, index)));
    messagesElement.append(fragment);
  }
  if (scrollToEnd) requestAnimationFrame(scrollConversationToEnd);
  updateControls();
}

function refreshMessage(index) {
  const article = messagesElement.querySelector(`[data-message-index="${index}"]`);
  if (!article) {
    render({ scrollToEnd: true });
    return;
  }
  const followOutput = isNearConversationEnd();
  updateMessageElement(article, messages[index], index);
  if (followOutput) requestAnimationFrame(scrollConversationToEnd);
}

function scheduleMessageRefresh(index) {
  if (pendingMessageFrame !== null) return;
  pendingMessageFrame = requestAnimationFrame(() => {
    pendingMessageFrame = null;
    refreshMessage(index);
  });
}

async function updateThinkingSupport(preference = reasoningElement.dataset.preference || reasoningElement.value) {
  const requestVersion = ++thinkingRequestVersion;
  const selectedModel = modelElement.value;
  thinkingMode = 'none';

  try {
    const response = await fetch('/ollama/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel })
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    if (requestVersion !== thinkingRequestVersion || selectedModel !== modelElement.value) return;
    if (Array.isArray(data.capabilities) && data.capabilities.includes('thinking')) {
      thinkingMode = modelUsesEffortLevels(selectedModel) ? 'levels' : 'toggle';
    }
  } catch {
    if (requestVersion !== thinkingRequestVersion || selectedModel !== modelElement.value) return;
    thinkingMode = 'none';
  }

  configureReasoningOptions(preference);
  const reasoningLabel = reasoningElement.parentElement;
  if (thinkingMode === 'levels') {
    reasoningLabel.title = 'Choose the GPT-OSS reasoning effort';
    reasoningElement.setAttribute('aria-label', 'Thinking effort');
  } else if (thinkingMode === 'toggle') {
    reasoningLabel.title = 'Turn model reasoning on or off';
    reasoningElement.setAttribute('aria-label', 'Thinking');
  } else {
    reasoningLabel.title = 'This model does not support thinking';
    reasoningElement.setAttribute('aria-label', 'Thinking unavailable');
  }
  updateControls();
}

function updateControls() {
  const selectedOption = modelElement.selectedOptions[0];
  const hasModel = Boolean(modelElement.value && selectedOption && !selectedOption.disabled);
  sendElement.disabled = !hasModel;
  sendElement.classList.toggle('generating', generating);
  sendElement.textContent = generating ? '■' : '↑';
  sendElement.setAttribute('aria-label', generating ? 'Stop generating' : 'Send message');
  sendElement.title = generating ? 'Stop generating' : 'Send message';
  modelElement.disabled = generating;
  reasoningElement.disabled = generating || thinkingMode === 'none';
  answerStyleElement.disabled = generating;
  clearElement.disabled = generating || messages.length === 0;
  messagesElement.setAttribute('aria-busy', String(generating));
}

function setStatus(state, label) {
  statusElement.className = `status ${state}`;
  statusElement.lastElementChild.textContent = label;
  statusElement.setAttribute('aria-label', label);
  statusElement.title = label;
  updateControls();
}

async function loadModels(preferredModel) {
  try {
    const response = await fetch('/ollama/api/tags');
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    modelElement.replaceChildren();
    for (const item of models) {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      modelElement.append(option);
    }
    if (preferredModel && models.some(item => item.name === preferredModel)) {
      modelElement.value = preferredModel;
    }
    if (models.length === 0) throw new Error('No models installed');
    await updateThinkingSupport(reasoningElement.dataset.preference);
    setStatus('connected', 'Ollama connected');
    saveHistory();
  } catch (error) {
    modelElement.replaceChildren();
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No models available';
    option.disabled = true;
    option.selected = true;
    modelElement.append(option);
    thinkingMode = 'none';
    configureReasoningOptions('false');
    setStatus('error', error.message);
  }
}

async function generate() {
  const prompt = promptElement.value.trim();
  if (!prompt || generating || !modelElement.value) return;

  const model = modelElement.value;
  messages.push({ role: 'user', content: prompt });
  const assistantMessage = { role: 'assistant', model, content: '', thinking: '' };
  messages.push(assistantMessage);
  const assistantIndex = messages.length - 1;
  promptElement.value = '';
  generating = true;
  activeRequestController = new AbortController();
  const thinkValue = getThinkValue();
  const thinkingLabel = thinkingMode === 'levels' ? `Thinking · ${thinkValue}` : 'Thinking';
  setStatus('busy', thinkValue ? thinkingLabel : 'Generating');
  render({ scrollToEnd: true });

  let requestFailed = false;
  try {
    const response = await fetch('/ollama/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: activeRequestController.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: answerStyleInstructions[answerStyleElement.value] },
          ...messages
            .slice(0, -1)
            .filter(message => !message.failed)
            .map(({ role, content }) => ({ role, content }))
        ],
        stream: true,
        think: thinkValue,
        keep_alive: '30m'
      })
    });
    if (!response.ok || !response.body) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);
        if (chunk.error) throw new Error(chunk.error);
        assistantMessage.thinking += chunk.message?.thinking || '';
        assistantMessage.content += chunk.message?.content || '';
        scheduleMessageRefresh(assistantIndex);
      }
      if (done) break;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      if (!assistantMessage.content && !assistantMessage.thinking) {
        assistantMessage.content = 'Generation stopped.';
      }
    } else {
      requestFailed = true;
      assistantMessage.failed = true;
      assistantMessage.content = `Request failed: ${error.message}`;
    }
  } finally {
    if (pendingMessageFrame !== null) {
      cancelAnimationFrame(pendingMessageFrame);
      pendingMessageFrame = null;
    }
    generating = false;
    activeRequestController = null;
    setStatus(requestFailed ? 'error' : 'connected', requestFailed ? 'Request failed' : 'Ollama connected');
    saveHistory();
    refreshMessage(assistantIndex);
    promptElement.focus();
  }
}

const preferredModel = loadHistory();
render({ scrollToEnd: true });
loadModels(preferredModel);

document.querySelector('#composer').addEventListener('submit', event => {
  event.preventDefault();
  if (generating) {
    activeRequestController?.abort();
    return;
  }
  generate();
});

promptElement.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    generate();
  }
});

modelElement.addEventListener('change', async () => {
  const preference = reasoningElement.value;
  await updateThinkingSupport(preference);
  saveHistory();
});

reasoningElement.addEventListener('change', () => {
  reasoningElement.dataset.preference = reasoningElement.value;
  saveHistory();
});

answerStyleElement.addEventListener('change', saveHistory);
clearElement.addEventListener('click', () => {
  messages = [];
  saveHistory();
  render();
  promptElement.focus();
});
