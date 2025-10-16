'use strict';

// Interactive Examples functionality
let interactiveProblems = [];
let currentInteractiveProblemIndex = 0;

// Separate variables for each container
let interactiveProblemsLeakage = [];
let currentInteractiveProblemIndexLeakage = 0;
let interactiveProblemsPanic = [];
let currentInteractiveProblemIndexPanic = 0;
let interactiveProblemsDoubt = [];
let currentInteractiveProblemIndexDoubt = 0;

function escapeHTML(str = "") {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function truncate(text = "", limit = 96) {
    const base = String(text);
    return base.length > limit ? base.slice(0, limit).trim() + "…" : base;
}

function slugify(text = "model") {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "model";
}

function formatPlainText(value = "") {
    const tokens = tokenizePlainText(String(value));
    return tokens.map(renderPlainToken).join("");
}

function tokenizePlainText(input) {
    const tokens = [];
    let idx = 0;
    let buffer = "";

    const flushBuffer = () => {
        if (buffer) {
            tokens.push({ type: "text", content: buffer });
            buffer = "";
        }
    };

    while (idx < input.length) {
        if (input.startsWith("```", idx)) {
            const fenceEnd = input.indexOf("```", idx + 3);
            if (fenceEnd === -1) {
                buffer += input.slice(idx);
                break;
            }

            flushBuffer();

            let lang = "";
            let contentStart = idx + 3;
            const newlineIdx = input.indexOf("\n", idx + 3);
            if (newlineIdx !== -1 && newlineIdx < fenceEnd) {
                lang = input.slice(idx + 3, newlineIdx).trim();
                contentStart = newlineIdx + 1;
            }
            const content = input.slice(contentStart, fenceEnd);
            tokens.push({ type: "codeblock", lang, content });
            idx = fenceEnd + 3;
            continue;
        }

        if (input.startsWith("**", idx)) {
            const end = input.indexOf("**", idx + 2);
            if (end === -1) {
                buffer += input[idx];
                idx += 1;
            } else {
                flushBuffer();
                const content = input.slice(idx + 2, end);
                tokens.push({ type: "bold", content });
                idx = end + 2;
            }
            continue;
        }

        if (input.startsWith("$$", idx)) {
            const prevChar = idx > 0 ? input[idx - 1] : null;
            if (prevChar === "\\") {
                buffer += "$";
                idx += 1;
                continue;
            }
            const fenceEnd = input.indexOf("$$", idx + 2);
            if (fenceEnd === -1) {
                buffer += input[idx];
                idx += 1;
                continue;
            }
            flushBuffer();
            const content = input.slice(idx + 2, fenceEnd);
            tokens.push({ type: "mathblock", content });
            idx = fenceEnd + 2;
            continue;
        }

        if (input[idx] === "$") {
            const prevChar = idx > 0 ? input[idx - 1] : null;
            if (prevChar === "\\") {
                buffer += "$";
                idx += 1;
                continue;
            }
            const end = input.indexOf("$", idx + 1);
            if (end === -1) {
                buffer += input[idx];
                idx += 1;
                continue;
            }
            flushBuffer();
            const content = input.slice(idx + 1, end);
            tokens.push({ type: "mathinline", content });
            idx = end + 1;
            continue;
        }

        if (input[idx] === "`") {
            const end = input.indexOf("`", idx + 1);
            if (end === -1) {
                buffer += input[idx];
                idx += 1;
            } else {
                flushBuffer();
                const content = input.slice(idx + 1, end);
                tokens.push({ type: "inline", content });
                idx = end + 1;
            }
            continue;
        }

        buffer += input[idx];
        idx += 1;
    }

    if (idx >= input.length && buffer) {
        tokens.push({ type: "text", content: buffer });
    }

    return tokens;
}

function renderPlainToken(token) {
    switch (token.type) {
        case "text":
            return escapeHTML(token.content).replace(/\n/g, "<br>");
        case "bold":
            return `<strong>${formatPlainText(token.content)}</strong>`;
        case "inline": {
            const trimmed = token.content.trim();
            if (/^latex[:\s]/i.test(trimmed)) {
                const latexContent = trimmed.replace(/^latex[:\s]*/i, "");
                return wrapLatex(latexContent);
            }
            return `<code class="inline-code">${escapeHTML(token.content)}</code>`;
        }
        case "codeblock": {
            const lang = (token.lang || "").trim().toLowerCase();
            if (lang === "latex" || lang === "math" || lang === "tex") {
                return wrapLatex(token.content.trim());
            }
            const languageClass = lang ? `language-${escapeHTML(lang)}` : "language-plaintext";
            return `<pre class="code-block"><code class="${languageClass}">${escapeHTML(token.content)}</code></pre>`;
        }
        case "mathinline": {
            const trimmed = token.content.trim();
            if (!trimmed) return "";
            return wrapLatex(trimmed);
        }
        case "mathblock": {
            const trimmed = token.content.trim();
            if (!trimmed) return "";
            return `<span class="mathjax-latex">\\[${trimmed}\\]</span>`;
        }
        default:
            return "";
    }
}

function wrapLatex(value = "") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const needsBlock = trimmed.includes("\n") || trimmed.includes("\\begin");
    return needsBlock ? `<span class="mathjax-latex">\\[${trimmed}\\]</span>` : `<span class="mathjax-latex">\\(${trimmed}\\)</span>`;
}

function renderRich(content) {
    if (!content) return "";
    if (typeof content === "string") {
        return formatPlainText(content);
    }
    const format = content.format || "text";
    const value = content.value ?? "";
    if (!value) return "";
    if (format === "latex") return wrapLatex(String(value));
    if (format === "html") return String(value);
    return formatPlainText(value);
}

function normalizeContent(content, fallbackValue = "") {
    if (!content && !fallbackValue) {
        return null;
    }
    if (typeof content === "string") {
        return { format: "text", value: content };
    }
    if (content && typeof content === "object") {
        const value = content.value ?? fallbackValue;
        return { format: content.format || "text", value };
    }
    return { format: "text", value: fallbackValue };
}

function getContentString(raw, fallbackValue = "") {
    if (raw == null) {
        return fallbackValue;
    }
    if (typeof raw === "string") {
        return raw;
    }
    if (typeof raw === "object") {
        const value = raw.value ?? fallbackValue;
        return typeof value === "string" ? value : String(value ?? "");
    }
    return String(raw);
}

function countCharacters(text = "") {
    if (!text) return 0;
    return String(text).length;
}

function extractQuestion(problem) {
    const question = problem.question;
    const fallbackUrl = problem && typeof problem === "object" ? (problem.url || problem.href || null) : null;
    if (!question) {
        return { title: "Untitled Problem", content: null, url: fallbackUrl };
    }
    if (typeof question === "string") {
        return { title: question, content: { format: "text", value: question }, url: fallbackUrl };
    }
    const title = question.title || "Untitled Problem";
    const content = normalizeContent(question.content, title);
    const url = question.url || question.href || fallbackUrl || null;
    return { title, content, url };
}

async function loadInteractiveProblems() {
    try {
        const container = document.getElementById('interactive-viz-container');
        if (!container) return;

        container.innerHTML = '<div class="interactive-viz"><div class="wrapper"><div class="header"><h1>Loading problems…</h1></div></div></div>';

        const response = await fetch("./interactive_examples_data.json", { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`Failed to load data (${response.status})`);
        }
        const payload = await response.json();
        interactiveProblems = Array.isArray(payload.problems) ? payload.problems : [];
        if (!interactiveProblems.length) {
            container.innerHTML = '<div class="interactive-viz"><div class="wrapper"><div class="header"><h1>No problems available.</h1></div></div></div>';
            return;
        }
        currentInteractiveProblemIndex = 0;
        renderInteractiveProblem();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('interactive-viz-container');
        if (container) {
            container.innerHTML = `<div class="interactive-viz"><div class="wrapper"><div class="header"><h1>Failed to load examples.</h1></div></div></div>`;
        }
    }
}

// Leakage container functions
async function loadInteractiveProblemsLeakage() {
    try {
        const container = document.getElementById('interactive-vis-container-leakage');
        if (!container) return;

        container.innerHTML = '<div class="interactive-viz-leakage"><div class="wrapper"><div class="header"><h1>Loading problems…</h1></div></div></div>';

        const response = await fetch("./examples_leakage.json", { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`Failed to load data (${response.status})`);
        }
        const payload = await response.json();
        interactiveProblemsLeakage = Array.isArray(payload.problems) ? payload.problems : [];
        if (!interactiveProblemsLeakage.length) {
            container.innerHTML = '<div class="interactive-viz-leakage"><div class="wrapper"><div class="header"><h1>No problems available.</h1></div></div></div>';
            return;
        }
        currentInteractiveProblemIndexLeakage = 0;
        renderInteractiveProblemLeakage();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('interactive-vis-container-leakage');
        if (container) {
            container.innerHTML = `<div class="interactive-viz-leakage"><div class="wrapper"><div class="header"><h1>Failed to load examples.</h1></div></div></div>`;
        }
    }
}

// Panic container functions
async function loadInteractiveProblemsPanic() {
    try {
        const container = document.getElementById('interactive-vis-container-panic');
        if (!container) return;

        container.innerHTML = '<div class="interactive-viz-panic"><div class="wrapper"><div class="header"><h1>Loading problems…</h1></div></div></div>';

        const response = await fetch("./examples_panic.json", { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`Failed to load data (${response.status})`);
        }
        const payload = await response.json();
        interactiveProblemsPanic = Array.isArray(payload.problems) ? payload.problems : [];
        if (!interactiveProblemsPanic.length) {
            container.innerHTML = '<div class="interactive-viz-panic"><div class="wrapper"><div class="header"><h1>No problems available.</h1></div></div></div>';
            return;
        }
        currentInteractiveProblemIndexPanic = 0;
        renderInteractiveProblemPanic();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('interactive-vis-container-panic');
        if (container) {
            container.innerHTML = `<div class="interactive-viz-panic"><div class="wrapper"><div class="header"><h1>Failed to load examples.</h1></div></div></div>`;
        }
    }
}

// Doubt container functions
async function loadInteractiveProblemsDoubt() {
    try {
        const container = document.getElementById('interactive-vis-container-doubt');
        if (!container) return;

        container.innerHTML = '<div class="interactive-viz-doubt"><div class="wrapper"><div class="header"><h1>Loading problems…</h1></div></div></div>';

        const response = await fetch("./examples_doubt.json", { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`Failed to load data (${response.status})`);
        }
        const payload = await response.json();
        interactiveProblemsDoubt = Array.isArray(payload.problems) ? payload.problems : [];
        if (!interactiveProblemsDoubt.length) {
            container.innerHTML = '<div class="interactive-viz-doubt"><div class="wrapper"><div class="header"><h1>No problems available.</h1></div></div></div>';
            return;
        }
        currentInteractiveProblemIndexDoubt = 0;
        renderInteractiveProblemDoubt();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('interactive-vis-container-doubt');
        if (container) {
            container.innerHTML = `<div class="interactive-viz-doubt"><div class="wrapper"><div class="header"><h1>Failed to load examples.</h1></div></div></div>`;
        }
    }
}


// Leakage render function
function renderInteractiveProblemLeakage() {
    if (!interactiveProblemsLeakage.length) {
        return;
    }
    const problem = interactiveProblemsLeakage[currentInteractiveProblemIndexLeakage];
    const { title, content, url: questionUrl } = extractQuestion(problem);

    const container = document.getElementById('interactive-vis-container-leakage');
    if (!container) return;

    const questionHTML = renderRich(content);
    const encodedQuestion = encodeURIComponent(questionHTML || "");
    const questionTitleHTML = questionUrl
        ? `<a href="${escapeAttribute(questionUrl)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>`
        : escapeHTML(title);
    const headerTitleHTML = "Examples of Hard Interrupt";
    const headerActions = `
        <div class="header-actions">
            <button id="interactive-prev-problem-leakage" title="Cycle through the previous problem">◀ Previous</button>
            <button id="interactive-next-problem-leakage" title="Cycle through the next problem">Next ▶</button>
        </div>
    `;

    container.innerHTML = `
        <div class="interactive-viz-leakage">
            <div class="wrapper">
                <div class="header">
                    <h1 id="interactive-question-title-leakage">${headerTitleHTML}</h1>
                    ${headerActions}
                </div>
                <div class="question-details" id="interactive-question-details-leakage">
                    <h2 class="question-preview-title">${questionTitleHTML}</h2>
                    <div class="question-content">${questionHTML}</div>
                    <button 
                        class="view-full-context-btn" 
                        data-type="question" 
                        data-title="${encodeURIComponent(title)}"
                        data-content="${encodedQuestion}">
                        View Full Problem
                    </button>
                </div>
                <div class="panels-container" id="interactive-panels-container-leakage"></div>
            </div>
        </div>
    `;

    const questionDetailsEl = document.getElementById('interactive-question-details-leakage');
    const viewFullQuestionBtn = questionDetailsEl ? questionDetailsEl.querySelector('.view-full-context-btn') : null;
    const panelsContainerEl = document.getElementById('interactive-panels-container-leakage');
    const prevProblemBtn = document.getElementById('interactive-prev-problem-leakage');
    const nextProblemBtn = document.getElementById('interactive-next-problem-leakage');

    renderInteractivePanelsLeakage(problem, panelsContainerEl);
    if (questionDetailsEl) {
        typesetMath(questionDetailsEl);
    }

    const updateQuestionClamp = () => {
        if (!questionDetailsEl) return;
        const isOverflowing = Math.ceil(questionDetailsEl.scrollHeight - questionDetailsEl.clientHeight) > 4;
        questionDetailsEl.classList.toggle('is-clamped', isOverflowing);
    };

    updateQuestionClamp();
    setTimeout(updateQuestionClamp, 200);
    setTimeout(updateQuestionClamp, 600);
    requestAnimationFrame(updateQuestionClamp);

    if (viewFullQuestionBtn) {
        viewFullQuestionBtn.addEventListener("click", (event) => {
            event.preventDefault();
            const contentValue = viewFullQuestionBtn.dataset.content || "";
            if (!contentValue) return;
            const encodedTitle = viewFullQuestionBtn.dataset.title;
            const titleValue = encodedTitle ? decodeURIComponent(encodedTitle) : title;
            showSeparateViewLeakage(contentValue, viewFullQuestionBtn.dataset.type || "question", `Full context - ${titleValue}`);
        });
    }

    prevProblemBtn.addEventListener("click", () => {
        currentInteractiveProblemIndexLeakage = (currentInteractiveProblemIndexLeakage - 1 + interactiveProblemsLeakage.length) % interactiveProblemsLeakage.length;
        renderInteractiveProblemLeakage();
    });

    nextProblemBtn.addEventListener("click", () => {
        currentInteractiveProblemIndexLeakage = (currentInteractiveProblemIndexLeakage + 1) % interactiveProblemsLeakage.length;
        renderInteractiveProblemLeakage();
    });
}

// Panic render function
function renderInteractiveProblemPanic() {
    if (!interactiveProblemsPanic.length) {
        return;
    }
    const problem = interactiveProblemsPanic[currentInteractiveProblemIndexPanic];
    const { title, content, url: questionUrl } = extractQuestion(problem);

    const container = document.getElementById('interactive-vis-container-panic');
    if (!container) return;

    const questionHTML = renderRich(content);
    const encodedQuestion = encodeURIComponent(questionHTML || "");
    const questionTitleHTML = questionUrl
        ? `<a href="${escapeAttribute(questionUrl)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>`
        : escapeHTML(title);
    const headerTitleHTML = "Examples of Soft Interrupt (Speedup)";
    const headerActions = `
        <div class="header-actions">
            <button id="interactive-prev-problem-panic" title="Cycle through the previous problem">◀ Previous</button>
            <button id="interactive-next-problem-panic" title="Cycle through the next problem">Next ▶</button>
        </div>
    `;

    container.innerHTML = `
        <div class="interactive-viz-panic">
            <div class="wrapper">
                <div class="header">
                    <h1 id="interactive-question-title-panic">${headerTitleHTML}</h1>
                    ${headerActions}
                </div>
                <div class="question-details" id="interactive-question-details-panic">
                    <h2 class="question-preview-title">${questionTitleHTML}</h2>
                    <div class="question-content">${questionHTML}</div>
                    <button 
                        class="view-full-context-btn" 
                        data-type="question" 
                        data-title="${encodeURIComponent(title)}"
                        data-content="${encodedQuestion}">
                        View Full Problem
                    </button>
                </div>
                <div class="panels-container" id="interactive-panels-container-panic"></div>
            </div>
        </div>
    `;

    const questionDetailsEl = document.getElementById('interactive-question-details-panic');
    const viewFullQuestionBtn = questionDetailsEl ? questionDetailsEl.querySelector('.view-full-context-btn') : null;
    const panelsContainerEl = document.getElementById('interactive-panels-container-panic');
    const prevProblemBtn = document.getElementById('interactive-prev-problem-panic');
    const nextProblemBtn = document.getElementById('interactive-next-problem-panic');

    renderInteractivePanelsPanic(problem, panelsContainerEl);
    if (questionDetailsEl) {
        typesetMath(questionDetailsEl);
    }

    const updateQuestionClamp = () => {
        if (!questionDetailsEl) return;
        const isOverflowing = Math.ceil(questionDetailsEl.scrollHeight - questionDetailsEl.clientHeight) > 4;
        questionDetailsEl.classList.toggle('is-clamped', isOverflowing);
    };

    updateQuestionClamp();
    setTimeout(updateQuestionClamp, 200);
    setTimeout(updateQuestionClamp, 600);
    requestAnimationFrame(updateQuestionClamp);

    if (viewFullQuestionBtn) {
        viewFullQuestionBtn.addEventListener("click", (event) => {
            event.preventDefault();
            const contentValue = viewFullQuestionBtn.dataset.content || "";
            if (!contentValue) return;
            const encodedTitle = viewFullQuestionBtn.dataset.title;
            const titleValue = encodedTitle ? decodeURIComponent(encodedTitle) : title;
            showSeparateViewPanic(contentValue, viewFullQuestionBtn.dataset.type || "question", `Full context - ${titleValue}`);
        });
    }

    prevProblemBtn.addEventListener("click", () => {
        currentInteractiveProblemIndexPanic = (currentInteractiveProblemIndexPanic - 1 + interactiveProblemsPanic.length) % interactiveProblemsPanic.length;
        renderInteractiveProblemPanic();
    });

    nextProblemBtn.addEventListener("click", () => {
        currentInteractiveProblemIndexPanic = (currentInteractiveProblemIndexPanic + 1) % interactiveProblemsPanic.length;
        renderInteractiveProblemPanic();
    });
}

// Doubt render function
function renderInteractiveProblemDoubt() {
    if (!interactiveProblemsDoubt.length) {
        return;
    }
    const problem = interactiveProblemsDoubt[currentInteractiveProblemIndexDoubt];
    const { title, content, url: questionUrl } = extractQuestion(problem);

    const container = document.getElementById('interactive-vis-container-doubt');
    if (!container) return;

    const questionHTML = renderRich(content);
    const encodedQuestion = encodeURIComponent(questionHTML || "");
    const questionTitleHTML = questionUrl
        ? `<a href="${escapeAttribute(questionUrl)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>`
        : escapeHTML(title);
    const headerTitleHTML = "Examples of Update-Driven Interrupt";
    const headerActions = `
        <div class="header-actions">
            <button id="interactive-prev-problem-doubt" title="Cycle through the previous problem">◀ Previous</button>
            <button id="interactive-next-problem-doubt" title="Cycle through the next problem">Next ▶</button>
        </div>
    `;

    container.innerHTML = `
        <div class="interactive-viz-doubt">
            <div class="wrapper">
                <div class="header">
                    <h1 id="interactive-question-title-doubt">${headerTitleHTML}</h1>
                    ${headerActions}
                </div>
                <div class="question-details" id="interactive-question-details-doubt">
                    <h2 class="question-preview-title">${questionTitleHTML}</h2>
                    <div class="question-content">${questionHTML}</div>
                    <button 
                        class="view-full-context-btn" 
                        data-type="question" 
                        data-title="${encodeURIComponent(title)}"
                        data-content="${encodedQuestion}">
                        View Full Problem
                    </button>
                </div>
                <div class="panels-container" id="interactive-panels-container-doubt"></div>
            </div>
        </div>
    `;

    const questionDetailsEl = document.getElementById('interactive-question-details-doubt');
    const viewFullQuestionBtn = questionDetailsEl ? questionDetailsEl.querySelector('.view-full-context-btn') : null;
    const panelsContainerEl = document.getElementById('interactive-panels-container-doubt');
    const prevProblemBtn = document.getElementById('interactive-prev-problem-doubt');
    const nextProblemBtn = document.getElementById('interactive-next-problem-doubt');

    renderInteractivePanelsDoubt(problem, panelsContainerEl);
    if (questionDetailsEl) {
        typesetMath(questionDetailsEl);
    }

    const updateQuestionClamp = () => {
        if (!questionDetailsEl) return;
        const isOverflowing = Math.ceil(questionDetailsEl.scrollHeight - questionDetailsEl.clientHeight) > 4;
        questionDetailsEl.classList.toggle('is-clamped', isOverflowing);
    };

    updateQuestionClamp();
    setTimeout(updateQuestionClamp, 200);
    setTimeout(updateQuestionClamp, 600);
    requestAnimationFrame(updateQuestionClamp);

    if (viewFullQuestionBtn) {
        viewFullQuestionBtn.addEventListener("click", (event) => {
            event.preventDefault();
            const contentValue = viewFullQuestionBtn.dataset.content || "";
            if (!contentValue) return;
            const encodedTitle = viewFullQuestionBtn.dataset.title;
            const titleValue = encodedTitle ? decodeURIComponent(encodedTitle) : title;
            showSeparateViewDoubt(contentValue, viewFullQuestionBtn.dataset.type || "question", `Full context - ${titleValue}`);
        });
    }

    prevProblemBtn.addEventListener("click", () => {
        currentInteractiveProblemIndexDoubt = (currentInteractiveProblemIndexDoubt - 1 + interactiveProblemsDoubt.length) % interactiveProblemsDoubt.length;
        renderInteractiveProblemDoubt();
    });

    nextProblemBtn.addEventListener("click", () => {
        currentInteractiveProblemIndexDoubt = (currentInteractiveProblemIndexDoubt + 1) % interactiveProblemsDoubt.length;
        renderInteractiveProblemDoubt();
    });
}


function renderInteractivePanels(problem, panelsContainerEl) {
    const model = problem && typeof problem === "object" ? problem.model : null;
    if (!model || typeof model !== "object") {
        panelsContainerEl.innerHTML = '<div class="empty-state">No model data available for this problem.</div>';
        typesetMath();
        return;
    }

    const modelName = model.name || "Model";
    const modelLink = model && typeof model === "object" ? (model.url || model.href || null) : null;
    const baseId = `${problem.id || "problem"}-${slugify(modelName)}`;
    const logoSrc = model.logo ? escapeAttribute(model.logo) : null;
    const modelHeading = modelLink
        ? `<a href="${escapeAttribute(modelLink)}" target="_blank" rel="noopener">${escapeHTML(modelName)}</a>`
        : escapeHTML(modelName);
    const takeaway = model.takeaway ? escapeHTML(model.takeaway) : null;
    
    // Determine layout based on model configuration
    const layout = model.layout || "two"; // default to two columns for main section
    const stages = layout === "single" ? ["oracle"] : ["oracle", "interrupt"];

    panelsContainerEl.innerHTML = `
        ${takeaway ? `<div class="model-takeaway-standalone">${takeaway}</div>` : ""}
        <div class="model-header">
            ${logoSrc ? `<img src="${logoSrc}" alt="${escapeAttribute(modelName)} logo">` : ""}
            <div class="model-title-section">
                <h2>${modelHeading}</h2>
            </div>
        </div>
        <div class="model-panels ${layout === 'single' ? 'single-column' : 'two-column'}">
            ${stages.map(stage => {
                const stageData = model[stage] || {};
                const label = stageData.label || (stage === "oracle" ? "Full Thinking" : "Hard Interrupt @0.3");
                const renderedAnswer = stageData.answer ? renderRich(stageData.answer) : "";
                const previewReason = stageData.preview_reason ? renderRich(stageData.preview_reason) : "";
                const fullReasoningTrace = stageData.full_reasoning_trace ? renderRich(stageData.full_reasoning_trace) : "";
                const codeCharCount = stageData.code ? countCharacters(stageData.code) : 0;
                const answerCharCount = stageData.answer ? countCharacters(getContentString(stageData.answer)) : 0;
                const reasoningCharCount = stageData.full_reasoning_trace ? countCharacters(getContentString(stageData.full_reasoning_trace)) : 0;
                const codeCharLabel = codeCharCount > 0 ? `<p class="answer-line-count">Answer section: ${codeCharCount} CHARACTERS</p>` : "";
                const answerCharLabel = answerCharCount > 0 ? `<p class="answer-line-count">Answer section: ${answerCharCount} CHARACTERS</p>` : "";
                const isInterruptStage = stage === "interrupt";
                const reasoningLabelText = isInterruptStage ? "Reasoning (Update + Post Interrupt)" : "Reasoning Section";
                const reasoningCharLabel = reasoningCharCount > 0
                    ? `<p class="reasoning-line-count">${reasoningLabelText}: ${reasoningCharCount} CHARACTERS</p>`
                    : "";
                const reasoningSection = previewReason ? `
                    <div class="content-container">
                        ${reasoningCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(fullReasoningTrace)}" data-type="reasoning" data-title="Reasoning - ${label}">Open full view</button>
                        <div class="reasoning-answer limited">${previewReason}</div>
                    </div>
                ` : "";
                const codeSection = stageData.code ? `
                    <div class="content-container">
                        ${codeCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(stageData.code)}" data-type="code" data-title="Code - ${label}">Open full view</button>
                        <pre class="code-block"><code class="language-python">${escapeHTML(stageData.code)}</code></pre>
                    </div>` : "";
                const answerSection = stageData.answer ? `
                    <div class="content-container">
                        ${answerCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedAnswer)}" data-type="math" data-title="Math Answer - ${label}">Open full view</button>
                        <div class="math-answer">${renderedAnswer}</div>
                    </div>` : "";
                return `
                    <section class="panel">
                        <h3>${label}</h3>
                        ${reasoningSection}
                        ${codeSection}
                        ${answerSection}
                        ${finalSection}
                    </section>
                `;
            }).join("")}
        </div>
    `;

    panelsContainerEl.querySelectorAll("pre code").forEach(block => {
        if (window.hljs) {
            // Force Python syntax highlighting
            block.className = 'language-python';
            hljs.highlightElement(block);
            // Apply line numbers after highlighting
            applyLineNumbers(block);
        }
    });


    typesetMath();

    // Add event listeners for view separate buttons
    panelsContainerEl.querySelectorAll(".view-separate-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const content = btn.dataset.content;
            const type = btn.dataset.type;
            const title = btn.dataset.title;
            showSeparateView(content, type, title);
        });
    });
}

// Leakage panels function
function renderInteractivePanelsLeakage(problem, panelsContainerEl) {
    const model = problem && typeof problem === "object" ? problem.model : null;
    if (!model || typeof model !== "object") {
        panelsContainerEl.innerHTML = '<div class="empty-state">No model data available for this problem.</div>';
        typesetMath();
        return;
    }

    const modelName = model.name || "Model";
    const modelLink = model && typeof model === "object" ? (model.url || model.href || null) : null;
    const baseId = `${problem.id || "problem"}-${slugify(modelName)}`;
    const logoSrc = model.logo ? escapeAttribute(model.logo) : null;
    const modelHeading = modelLink
        ? `<a href="${escapeAttribute(modelLink)}" target="_blank" rel="noopener">${escapeHTML(modelName)}</a>`
        : escapeHTML(modelName);
    const takeaway = model.takeaway ? escapeHTML(model.takeaway) : null;
    
    // Determine layout based on model configuration
    const layout = model.layout || "two"; // default to two columns for leakage section
    const stages = layout === "single" ? ["oracle"] : ["oracle", "interrupt"];

    panelsContainerEl.innerHTML = `
        ${takeaway ? `<div class="model-takeaway-standalone">${takeaway}</div>` : ""}
        <div class="model-header">
            ${logoSrc ? `<img src="${logoSrc}" alt="${escapeAttribute(modelName)} logo">` : ""}
            <div class="model-title-section">
                <h2>${modelHeading}</h2>
            </div>
        </div>
        <div class="model-panels ${layout === 'single' ? 'single-column' : 'two-column'}">
            ${stages.map(stage => {
                const stageData = model[stage] || {};
                const label = stageData.label || (stage === "oracle" ? "Full Thinking" : "Hard Interrupt @0.3");
                const renderedAnswer = stageData.answer ? renderRich(stageData.answer) : "";
                const renderedFinal = stageData.final ? renderRich(stageData.final) : "";
                const previewReason = stageData.preview_reason ? renderRich(stageData.preview_reason) : "";
                const fullReasoningTrace = stageData.full_reasoning_trace ? renderRich(stageData.full_reasoning_trace) : "";
                const codeCharCount = stageData.code ? countCharacters(stageData.code) : 0;
                const answerCharCount = stageData.answer ? countCharacters(getContentString(stageData.answer)) : 0;
                const reasoningCharCount = stageData.full_reasoning_trace ? countCharacters(getContentString(stageData.full_reasoning_trace)) : 0;
                const codeCharLabel = codeCharCount > 0 ? `<p class="answer-line-count">Answer section: ${codeCharCount} CHARACTERS</p>` : "";
                const answerCharLabel = answerCharCount > 0 ? `<p class="answer-line-count">Answer section: ${answerCharCount} CHARACTERS</p>` : "";
                const isInterruptStage = stage === "interrupt";
                const reasoningLabelText = isInterruptStage ? "Reasoning (Update + Post Interrupt)" : "Reasoning Section";
                const reasoningCharLabel = reasoningCharCount > 0
                    ? `<p class="reasoning-line-count">${reasoningLabelText}: ${reasoningCharCount} CHARACTERS</p>`
                    : "";
                const reasoningSection = previewReason ? `
                    <div class="content-container">
                        ${reasoningCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(fullReasoningTrace)}" data-type="reasoning" data-title="Reasoning - ${label}">Open full view</button>
                        <div class="reasoning-answer limited">${previewReason}</div>
                    </div>
                ` : "";
                const codeSection = stageData.code ? `
                    <div class="content-container">
                        ${codeCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(stageData.code)}" data-type="code" data-title="Code - ${label}">Open full view</button>
                        <pre class="code-block"><code class="language-python">${escapeHTML(stageData.code)}</code></pre>
                    </div>` : "";
                const answerSection = stageData.answer ? `
                    <div class="content-container">
                        ${answerCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedAnswer)}" data-type="math" data-title="Math Answer - ${label}">Open full view</button>
                        <div class="math-answer">${renderedAnswer}</div>
                    </div>` : "";
                const finalSection = stageData.final ? `
                    <div class="content-container">
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedFinal)}" data-type="final" data-title="Final Answer - ${label}">Open full view</button>
                        <div class="final-answer">${renderedFinal}</div>
                    </div>` : "";
                return `
                    <section class="panel">
                        <h3>${label}</h3>
                        ${reasoningSection}
                        ${codeSection}
                        ${answerSection}
                        ${finalSection}
                    </section>
                `;
            }).join("")}
        </div>
    `;

    panelsContainerEl.querySelectorAll("pre code").forEach(block => {
        if (window.hljs) {
            // Force Python syntax highlighting
            block.className = 'language-python';
            hljs.highlightElement(block);
            // Apply line numbers after highlighting
            applyLineNumbers(block);
        }
    });

    panelsContainerEl.querySelectorAll(".view-reasoning-btn").forEach(btn => {
        btn.addEventListener("click", (event) => {
            event.preventDefault();
            const encoded = btn.dataset.content || "";
            if (!encoded) return;
            const title = btn.dataset.title || "Reasoning";
            showSeparateViewLeakage(encoded, "reasoning", title);
        });
    });

    typesetMath();

    // Add event listeners for view separate buttons
    panelsContainerEl.querySelectorAll(".view-separate-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const content = btn.dataset.content;
            const type = btn.dataset.type;
            const title = btn.dataset.title;
            showSeparateViewLeakage(content, type, title);
        });
    });
}

// Panic panels function
function renderInteractivePanelsPanic(problem, panelsContainerEl) {
    const model = problem && typeof problem === "object" ? problem.model : null;
    if (!model || typeof model !== "object") {
        panelsContainerEl.innerHTML = '<div class="empty-state">No model data available for this problem.</div>';
        typesetMath();
        return;
    }

    const modelName = model.name || "Model";
    const modelLink = model && typeof model === "object" ? (model.url || model.href || null) : null;
    const baseId = `${problem.id || "problem"}-${slugify(modelName)}`;
    const logoSrc = model.logo ? escapeAttribute(model.logo) : null;
    const modelHeading = modelLink
        ? `<a href="${escapeAttribute(modelLink)}" target="_blank" rel="noopener">${escapeHTML(modelName)}</a>`
        : escapeHTML(modelName);
    const takeaway = model.takeaway ? escapeHTML(model.takeaway) : null;
    
    // Determine layout based on model configuration
    const layout = model.layout || "single"; // default to single column
    const stages = layout === "single" ? ["oracle"] : ["oracle", "interrupt"];

    panelsContainerEl.innerHTML = `
        ${takeaway ? `<div class="model-takeaway-standalone">${takeaway}</div>` : ""}
        <div class="model-header">
            ${logoSrc ? `<img src="${logoSrc}" alt="${escapeAttribute(modelName)} logo">` : ""}
            <div class="model-title-section">
                <h2>${modelHeading}</h2>
            </div>
        </div>
        <div class="model-panels ${layout === 'single' ? 'single-column' : 'two-column'}">
            ${stages.map(stage => {
                const stageData = model[stage] || {};
                const label = stageData.label || "Full Thinking";
                const renderedAnswer = stageData.answer ? renderRich(stageData.answer) : "";
                const renderedFinal = stageData.final ? renderRich(stageData.final) : "";
                
                // For soft interrupt experiments, add reasoning sections
                const preInterruptReason = stageData.pre_interrupt_reason ? renderRich(stageData.pre_interrupt_reason) : "";
                const preInterruptFullReason = stageData.pre_interrupt_full_reason ? renderRich(stageData.pre_interrupt_full_reason) : "";
                const interruptLaterReason = stageData.interrupt_later_reason ? renderRich(stageData.interrupt_later_reason) : "";
                const interruptLaterFullReason = stageData.interrupt_later_full_reason ? renderRich(stageData.interrupt_later_full_reason) : "";
                
                const codeCharCount = stageData.code ? countCharacters(stageData.code) : 0;
                const answerCharCount = stageData.answer ? countCharacters(getContentString(stageData.answer)) : 0;
                const preInterruptCharCount = stageData.pre_interrupt_full_reason ? countCharacters(getContentString(stageData.pre_interrupt_full_reason)) : 0;
                const interruptLaterCharCount = stageData.interrupt_later_full_reason ? countCharacters(getContentString(stageData.interrupt_later_full_reason)) : 0;
                
                const codeCharLabel = codeCharCount > 0 ? `<p class="answer-line-count">Answer section: ${codeCharCount} CHARACTERS</p>` : "";
                const answerCharLabel = answerCharCount > 0 ? `<p class="answer-line-count">Answer section: ${answerCharCount} CHARACTERS</p>` : "";
                const preInterruptCharLabel = preInterruptCharCount > 0 ? `<p class="reasoning-line-count">Reasoning (Pre-Interrupt): ${preInterruptCharCount} CHARACTERS</p>` : "";
                const interruptLaterCharLabel = interruptLaterCharCount > 0 ? `<p class="reasoning-line-count">Reasoning (Interrupt + Later): ${interruptLaterCharCount} CHARACTERS</p>` : "";
                
                // Add reasoning (pre-interrupt) section
                const preInterruptSection = preInterruptReason ? `
                    <div class="content-container reasoning-pre">
                        ${preInterruptCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(preInterruptFullReason)}" data-type="reasoning" data-title="Reasoning (Pre-Interrupt) - ${label}">Open full view</button>
                        <div class="reasoning-answer speedup-pre">${preInterruptReason}</div>
                    </div>
                ` : "";
                
                // Add reasoning (interrupt + later) section
                const interruptLaterSection = interruptLaterReason ? `
                    <div class="content-container reasoning-post">
                        ${interruptLaterCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(interruptLaterFullReason)}" data-type="reasoning" data-title="Reasoning (Interrupt + Later) - ${label}">Open full view</button>
                        <div class="reasoning-answer speedup-post">${interruptLaterReason}</div>
                    </div>
                ` : "";
                
                const codeSection = stageData.code ? `
                    <div class="content-container">
                        ${codeCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(stageData.code)}" data-type="code" data-title="Code - ${label}">Open full view</button>
                        <pre class="code-block"><code class="language-python">${escapeHTML(stageData.code)}</code></pre>
                    </div>` : "";
                const answerSection = stageData.answer ? `
                    <div class="content-container">
                        ${answerCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedAnswer)}" data-type="math" data-title="Math Answer - ${label}">Open full view</button>
                        <div class="math-answer">${renderedAnswer}</div>
                    </div>` : "";
                const finalSection = stageData.final ? `
                    <div class="content-container">
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedFinal)}" data-type="final" data-title="Final Answer - ${label}">Open full view</button>
                        <div class="final-answer">${renderedFinal}</div>
                    </div>` : "";
                return `
                    <section class="panel">
                        <h3>${label}</h3>
                        ${preInterruptSection}
                        ${interruptLaterSection}
                        ${codeSection}
                        ${answerSection}
                        ${finalSection}
                    </section>
                `;
            }).join("")}
        </div>
    `;

    panelsContainerEl.querySelectorAll("pre code").forEach(block => {
        if (window.hljs) {
            // Force Python syntax highlighting
            block.className = 'language-python';
            hljs.highlightElement(block);
            // Apply line numbers after highlighting
            applyLineNumbers(block);
        }
    });

    panelsContainerEl.querySelectorAll(".view-reasoning-btn").forEach(btn => {
        btn.addEventListener("click", (event) => {
            event.preventDefault();
            const encoded = btn.dataset.content || "";
            if (!encoded) return;
            const title = btn.dataset.title || "Reasoning";
            showSeparateViewPanic(encoded, "reasoning", title);
        });
    });

    typesetMath();

    // Add event listeners for view separate buttons
    panelsContainerEl.querySelectorAll(".view-separate-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const content = btn.dataset.content;
            const type = btn.dataset.type;
            const title = btn.dataset.title;
            showSeparateViewPanic(content, type, title);
        });
    });
}

// Doubt panels function
function renderInteractivePanelsDoubt(problem, panelsContainerEl) {
    const model = problem && typeof problem === "object" ? problem.model : null;
    if (!model || typeof model !== "object") {
        panelsContainerEl.innerHTML = '<div class="empty-state">No model data available for this problem.</div>';
        typesetMath();
        return;
    }

    const modelName = model.name || "Model";
    const modelLink = model && typeof model === "object" ? (model.url || model.href || null) : null;
    const baseId = `${problem.id || "problem"}-${slugify(modelName)}`;
    const logoSrc = model.logo ? escapeAttribute(model.logo) : null;
    const modelHeading = modelLink
        ? `<a href="${escapeAttribute(modelLink)}" target="_blank" rel="noopener">${escapeHTML(modelName)}</a>`
        : escapeHTML(modelName);
    const takeaway = model.takeaway ? escapeHTML(model.takeaway) : null;
    const hasInterruptStage = model.interrupt && typeof model.interrupt === "object";
    const layout = model.layout || (hasInterruptStage ? "two" : "single");
    const stages = layout === "single" ? ["oracle"] : ["oracle", "interrupt"];

    const oracleData = model.oracle || {};
    const interruptData = model.interrupt || {};
    const sharedPreReasonSource =
        model.shared_pre_reason ??
        oracleData.pre_interrupt_reason ??
        interruptData.pre_interrupt_reason ??
        null;
    const sharedPreFullReasonSource =
        model.shared_pre_full_reason ??
        oracleData.pre_interrupt_full_reason ??
        interruptData.pre_interrupt_full_reason ??
        null;

    const sharedPreExists = Boolean(sharedPreReasonSource || sharedPreFullReasonSource);
    const sharedPreReason = sharedPreExists
        ? renderRich(sharedPreReasonSource || sharedPreFullReasonSource)
        : "";
    const sharedPreFullReason = sharedPreFullReasonSource
        ? renderRich(sharedPreFullReasonSource)
        : sharedPreReason;
    const sharedPreCharCount = sharedPreFullReasonSource
        ? countCharacters(getContentString(sharedPreFullReasonSource))
        : (sharedPreReasonSource ? countCharacters(getContentString(sharedPreReasonSource)) : 0);
    const sharedPreCharLabel = sharedPreCharCount > 0
        ? `<p class="reasoning-line-count">Reasoning (Before Update): ${sharedPreCharCount} CHARACTERS</p>`
        : "";
    const sharedPreSection = sharedPreExists ? `
        <div class="content-container shared-reasoning">
            ${sharedPreCharLabel}
            <button class="view-separate-btn" data-content="${encodeURIComponent(sharedPreFullReason)}" data-type="reasoning" data-title="Reasoning (Before Update)">Open full view</button>
            <div class="reasoning-answer intervene-pre limited">${sharedPreReason}</div>
        </div>
    ` : "";

    const updateCandidates = Array.isArray(problem.updates)
        ? problem.updates
        : (Array.isArray(model.updates) ? model.updates : null);
    const updateLeftSource =
        model.update_left ??
        problem.update_left ??
        (updateCandidates && updateCandidates[0]) ??
        null;
    const updateRightSource =
        model.update_right ??
        problem.update_right ??
        (updateCandidates && updateCandidates[1]) ??
        null;
    const updateLeftContent = updateLeftSource ? renderRich(updateLeftSource) : `<p class="update-placeholder">No update provided.</p>`;
    const updateRightContent = updateRightSource ? renderRich(updateRightSource) : `<p class="update-placeholder">No update provided.</p>`;
    const updateLeftCharCount = updateLeftSource ? countCharacters(getContentString(updateLeftSource)) : 0;
    const updateRightCharCount = updateRightSource ? countCharacters(getContentString(updateRightSource)) : 0;
    const updateLeftCharLabel = updateLeftCharCount > 0
        ? `<p class="answer-line-count">Update Section: ${updateLeftCharCount} CHARACTERS</p>`
        : "";
    const updateRightCharLabel = updateRightCharCount > 0
        ? `<p class="answer-line-count">Update Section: ${updateRightCharCount} CHARACTERS</p>`
        : "";
    const updateLeftSection = `
        <div class="content-container update-block">
            <h3 class="update-heading">Update</h3>
            ${updateLeftCharLabel}
            <div class="reasoning-answer intervene-pre limited">${updateLeftContent}</div>
        </div>
    `;
    
    const updateRightSection = `
        <div class="content-container update-block">
            <h3 class="update-heading">Update</h3>
            ${updateRightCharLabel}
            <div class="reasoning-answer intervene-pre limited">${updateRightContent}</div>
        </div>
    `;

    panelsContainerEl.innerHTML = `
        ${takeaway ? `<div class="model-takeaway-standalone">${takeaway}</div>` : ""}
        <div class="model-header">
            <div class="model-heading">
                ${logoSrc ? `<img src="${logoSrc}" alt="${escapeAttribute(modelName)} logo">` : ""}
                <h2>${modelHeading}</h2>
            </div>
            ${sharedPreSection}
        </div>
        <div class="model-panels ${layout === "single" ? "single-column" : "two-column"}">
            ${stages.map(stage => {
                const stageData = model[stage] || {};
                const label = stageData.label || (stage === "oracle" ? "Full Thinking" : "Intervene @0.3");
                const renderedAnswer = stageData.answer ? renderRich(stageData.answer) : "";
                const renderedFinal = stageData.final ? renderRich(stageData.final) : "";
                const previewReason = stageData.preview_reason ? renderRich(stageData.preview_reason) : "";
                const fullReasoningTrace = stageData.full_reasoning_trace ? renderRich(stageData.full_reasoning_trace) : "";
                const hasSoftInterruptStructure = Boolean(
                    stageData.pre_interrupt_reason ||
                    stageData.pre_interrupt_full_reason ||
                    stageData.interrupt_later_reason ||
                    stageData.interrupt_later_full_reason
                );

                const preInterruptReason = stageData.pre_interrupt_reason ? renderRich(stageData.pre_interrupt_reason) : "";
                const preInterruptFullReasonRendered = stageData.pre_interrupt_full_reason
                    ? renderRich(stageData.pre_interrupt_full_reason)
                    : preInterruptReason;
                const interruptLaterReason = stageData.interrupt_later_reason ? renderRich(stageData.interrupt_later_reason) : "";
                const interruptLaterFullReasonRendered = stageData.interrupt_later_full_reason
                    ? renderRich(stageData.interrupt_later_full_reason)
                    : interruptLaterReason;

                const codeCharCount = stageData.code ? countCharacters(stageData.code) : 0;
                const answerCharCount = stageData.answer ? countCharacters(getContentString(stageData.answer)) : 0;
                const reasoningCharCount = stageData.full_reasoning_trace ? countCharacters(getContentString(stageData.full_reasoning_trace)) : 0;
                const preInterruptCharCount = stageData.pre_interrupt_full_reason
                    ? countCharacters(getContentString(stageData.pre_interrupt_full_reason))
                    : (stageData.pre_interrupt_reason ? countCharacters(getContentString(stageData.pre_interrupt_reason)) : 0);
                const interruptLaterCharCount = stageData.interrupt_later_full_reason
                    ? countCharacters(getContentString(stageData.interrupt_later_full_reason))
                    : (stageData.interrupt_later_reason ? countCharacters(getContentString(stageData.interrupt_later_reason)) : 0);

                const codeCharLabel = codeCharCount > 0 ? `<p class="answer-line-count">Answer section: ${codeCharCount} CHARACTERS</p>` : "";
                const answerCharLabel = answerCharCount > 0 ? `<p class="answer-line-count">Answer section: ${answerCharCount} CHARACTERS</p>` : "";
                const isInterruptStage = stage === "interrupt";
                const reasoningLabelText = isInterruptStage ? "Reasoning (Update + Post Interrupt)" : "Reasoning Section";
                const reasoningCharLabel = reasoningCharCount > 0
                    ? `<p class="reasoning-line-count">${reasoningLabelText}: ${reasoningCharCount} CHARACTERS</p>`
                    : "";
                const preInterruptCharLabel = preInterruptCharCount > 0
                    ? `<p class="reasoning-line-count">Reasoning (Before Update): ${preInterruptCharCount} CHARACTERS</p>`
                    : "";
                const interruptLaterCharLabel = interruptLaterCharCount > 0
                    ? `<p class="reasoning-line-count">Reasoning (Update + Post Interrupt): ${interruptLaterCharCount} CHARACTERS</p>`
                    : "";

    const showSharedPre = sharedPreExists;

                const reasoningSection = (!hasSoftInterruptStructure || !showSharedPre) && previewReason ? `
                    <div class="content-container">
                        ${reasoningCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(fullReasoningTrace)}" data-type="reasoning" data-title="${reasoningLabelText} - ${label}">Open full view</button>
                        <div class="reasoning-answer${isInterruptStage ? " intervene-post" : ""} limited">${previewReason}</div>
                    </div>
                ` : "";

                const preInterruptSection = hasSoftInterruptStructure && preInterruptReason && !showSharedPre ? `
                    <div class="content-container reasoning-pre">
                        ${preInterruptCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(preInterruptFullReasonRendered)}" data-type="reasoning" data-title="Reasoning (Before Update) - ${label}">Open full view</button>
                        <div class="reasoning-answer intervene-pre limited">${preInterruptReason}</div>
                    </div>
                ` : "";

                const interruptLaterSection = hasSoftInterruptStructure && interruptLaterReason ? `
                    <div class="content-container reasoning-post">
                        ${interruptLaterCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(interruptLaterFullReasonRendered)}" data-type="reasoning" data-title="Reasoning (Update + Post Interrupt) - ${label}">Open full view</button>
                        <div class="reasoning-answer intervene-post limited">${interruptLaterReason}</div>
                    </div>
                ` : "";

                const codeSection = stageData.code ? `
                    <div class="content-container">
                        ${codeCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(stageData.code)}" data-type="code" data-title="Code - ${label}">Open full view</button>
                        <pre class="code-block"><code class="language-python">${escapeHTML(stageData.code)}</code></pre>
                    </div>` : "";
                const answerSection = stageData.answer ? `
                    <div class="content-container">
                        ${answerCharLabel}
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedAnswer)}" data-type="math" data-title="Math Answer - ${label}">Open full view</button>
                        <div class="math-answer">${renderedAnswer}</div>
                    </div>` : "";
                const finalSection = stageData.final ? `
                    <div class="content-container">
                        <button class="view-separate-btn" data-content="${encodeURIComponent(renderedFinal)}" data-type="final" data-title="Final Answer - ${label}">Open full view</button>
                        <div class="final-answer">${renderedFinal}</div>
                    </div>` : "";


                // For doubt section, show oracle (Full Thinking) on left with updateLeft, 
                // and interrupt (Intervene @0.3) on right with updateRight
                if (stage === "oracle") {
                    return `
                        <section class="panel">
                            <h3>${label}</h3>
                            ${preInterruptSection}
                            ${updateLeftSection}
                            ${interruptLaterSection}
                            ${answerSection}
                            ${codeSection}
                            ${finalSection}
                        </section>
                    `;
                } else if (stage === "interrupt") {
                    return `
                        <section class="panel">
                            <h3>${label}</h3>
                            ${preInterruptSection}
                            ${updateRightSection}
                            ${interruptLaterSection}
                            ${answerSection}
                            ${codeSection}
                            ${finalSection}
                        </section>
                    `;
                }
                return "";
            }).join("")}
        </div>
    `;

    panelsContainerEl.querySelectorAll("pre code").forEach(block => {
        if (window.hljs) {
            // Force Python syntax highlighting
            block.className = 'language-python';
            hljs.highlightElement(block);
            // Apply line numbers after highlighting
            applyLineNumbers(block);
        }
    });

    panelsContainerEl.querySelectorAll(".view-reasoning-btn").forEach(btn => {
        btn.addEventListener("click", (event) => {
            event.preventDefault();
            const encoded = btn.dataset.content || "";
            if (!encoded) return;
            const title = btn.dataset.title || "Reasoning";
            showSeparateViewDoubt(encoded, "reasoning", title);
        });
    });

    typesetMath();

    // Add event listeners for view separate buttons
    panelsContainerEl.querySelectorAll(".view-separate-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const content = btn.dataset.content;
            const type = btn.dataset.type;
            const title = btn.dataset.title;
            showSeparateViewDoubt(content, type, title);
        });
    });
}

function showSeparateView(content, type, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('separate-view-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'separate-view-modal';
        modal.className = 'interactive-viz modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header">
                    <h2 id="modal-title"></h2>
                </div>
                <div id="modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add close functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });
    }

    // Set content
    document.getElementById('modal-title').textContent = title;
    const modalBody = document.getElementById('modal-body');

    if (type === 'code') {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = `<pre class="code-block"><code class="language-python">${escapeHTML(decodedContent)}</code></pre>`;
        // Apply syntax highlighting first, then line numbers
        modalBody.querySelectorAll("pre code").forEach(block => {
            if (window.hljs) {
                // Apply syntax highlighting first
                block.className = 'language-python';
                hljs.highlightElement(block);
                // Then apply line numbers to the highlighted content
                applyLineNumbers(block);
            }
        });
    } else {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = decodedContent;
        typesetMath(modalBody);
    }
    modalBody.scrollTop = 0;

    // Show modal
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

// Leakage modal function
function showSeparateViewLeakage(content, type, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('separate-view-modal-leakage');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'separate-view-modal-leakage';
        modal.className = 'interactive-viz-leakage modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header">
                    <h2 id="modal-title-leakage"></h2>
                </div>
                <div id="modal-body-leakage"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add close functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });
    }

    // Set content
    document.getElementById('modal-title-leakage').textContent = title;
    const modalBody = document.getElementById('modal-body-leakage');

    if (type === 'code') {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = `<pre class="code-block"><code class="language-python">${escapeHTML(decodedContent)}</code></pre>`;
        // Apply syntax highlighting first, then line numbers
        modalBody.querySelectorAll("pre code").forEach(block => {
            if (window.hljs) {
                // Apply syntax highlighting first
                block.className = 'language-python';
                hljs.highlightElement(block);
                // Then apply line numbers to the highlighted content
                applyLineNumbers(block);
            }
        });
    } else {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = decodedContent;
        typesetMath(modalBody);
    }
    modalBody.scrollTop = 0;

    // Show modal
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

// Panic modal function
function showSeparateViewPanic(content, type, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('separate-view-modal-panic');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'separate-view-modal-panic';
        modal.className = 'interactive-viz-panic modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header">
                    <h2 id="modal-title-panic"></h2>
                </div>
                <div id="modal-body-panic"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add close functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });
    }

    // Set content
    document.getElementById('modal-title-panic').textContent = title;
    const modalBody = document.getElementById('modal-body-panic');

    if (type === 'code') {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = `<pre class="code-block"><code class="language-python">${escapeHTML(decodedContent)}</code></pre>`;
        // Apply syntax highlighting first, then line numbers
        modalBody.querySelectorAll("pre code").forEach(block => {
            if (window.hljs) {
                // Apply syntax highlighting first
                block.className = 'language-python';
                hljs.highlightElement(block);
                // Then apply line numbers to the highlighted content
                applyLineNumbers(block);
            }
        });
    } else {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = decodedContent;
        typesetMath(modalBody);
    }
    modalBody.scrollTop = 0;

    // Show modal
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

// Doubt modal function
function showSeparateViewDoubt(content, type, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('separate-view-modal-doubt');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'separate-view-modal-doubt';
        modal.className = 'interactive-viz-doubt modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header">
                    <h2 id="modal-title-doubt"></h2>
                </div>
                <div id="modal-body-doubt"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add close functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });
    }

    // Set content
    document.getElementById('modal-title-doubt').textContent = title;
    const modalBody = document.getElementById('modal-body-doubt');

    if (type === 'code') {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = `<pre class="code-block"><code class="language-python">${escapeHTML(decodedContent)}</code></pre>`;
        // Apply syntax highlighting first, then line numbers
        modalBody.querySelectorAll("pre code").forEach(block => {
            if (window.hljs) {
                // Apply syntax highlighting first
                block.className = 'language-python';
                hljs.highlightElement(block);
                // Then apply line numbers to the highlighted content
                applyLineNumbers(block);
            }
        });
    } else {
        const decodedContent = decodeURIComponent(content);
        modalBody.innerHTML = decodedContent;
        typesetMath(modalBody);
    }
    modalBody.scrollTop = 0;

    // Show modal
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

function applyLineNumbers(codeEl) {
    if (!codeEl || codeEl.dataset.lineNumbers === "true") {
        return;
    }

    const pre = codeEl.parentElement;
    if (!pre || !pre.classList.contains("code-block")) {
        return;
    }

    const rawText = (codeEl.textContent || "").replace(/\r\n/g, "\n");
    let totalLines = rawText.split("\n").length;

    if (rawText.endsWith("\n")) {
        totalLines -= 1;
    }

    if (totalLines < 1) {
        totalLines = 1;
    }

    const numbers = document.createElement("span");
    numbers.className = "line-numbers";
    numbers.setAttribute("aria-hidden", "true");

    const fragment = document.createDocumentFragment();
    for (let idx = 1; idx <= totalLines; idx += 1) {
        const marker = document.createElement("span");
        marker.textContent = idx;
        fragment.appendChild(marker);
    }

    numbers.appendChild(fragment);
    pre.insertBefore(numbers, codeEl);

    codeEl.dataset.lineNumbers = "true";
    pre.dataset.lineNumbers = "true";
}

function typesetMath(scope) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        if (scope) {
            MathJax.typesetPromise([scope]);
        } else {
            MathJax.typesetPromise();
        }
    }
}

// Initialize interactive examples when page loads
window.addEventListener("load", () => {
    typesetMath();
    loadInteractiveProblems();
    loadInteractiveProblemsLeakage();
    loadInteractiveProblemsPanic();
    loadInteractiveProblemsDoubt();
});
