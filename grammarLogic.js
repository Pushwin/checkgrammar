// Global variables for tracking corrections and analysis
let appliedRulesList = [];
let errorAnalysis = {
    total: 0,
    types: {},
    corrections: 0,
    confidence: 0
};

// API configuration
const API_CONFIG = {
    gemini: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
        model: 'gemini-1.5-flash-latest'
    }
};

// Enhanced grammar checking function
async function checkGrammar() {
    const input = document.getElementById("inputText").value.trim();
    
    if (!input) {
        showError("Please enter some text to check.");
        return;
    }

    // Show loading state
    showLoading(true);
    resetResults();

    try {
        // Get API key from input or environment
        const apiKey = document.getElementById("apiKey").value.trim() || 
                      (typeof process !== 'undefined' ? process.env.GOOGLE_API_KEY : null);

        // Perform rule-based correction first (always available)
        const ruleBasedResult = performRuleBasedCorrection(input);
        displayRuleBasedResults(ruleBasedResult);

        // Attempt AI correction if API key is available
        if (apiKey) {
            try {
                const aiResult = await performAICorrection(input, apiKey);
                displayAIResults(aiResult);
                updateAnalysis(ruleBasedResult, aiResult);
                setStatus('aiStatus', 'success', 'AI correction completed');
            } catch (aiError) {
                console.warn('AI correction failed:', aiError);
                displayAIFallback(ruleBasedResult);
                setStatus('aiStatus', 'error', 'AI unavailable, using rule-based correction');
            }
        } else {
            displayAIFallback(ruleBasedResult);
            setStatus('aiStatus', 'warning', 'API key required for AI correction');
        }

        // Show results section
        document.getElementById('resultsSection').style.display = 'block';

    } catch (error) {
        console.error('Grammar check error:', error);
        showError("An error occurred while checking grammar. Please try again.");
    } finally {
        showLoading(false);
    }
}

// Rule-based correction (enhanced from original)
function performRuleBasedCorrection(input) {
    let words = input.toLowerCase().replace(/[.?!]/g, "").split(" ");
    let corrected = [...words];
    let originalWords = input.split(" ");
    appliedRulesList = [];
    let corrections = 0;

    // Enhanced spell checking
    for (let i = 0; i < words.length; i++) {
        let word = words[i];
        let originalWord = originalWords[i];

        // Apply all existing rules from the original code
        applyArticleRules(words, corrected, i, originalWord);
        applyVerbAgreementRules(words, corrected, i, originalWord);
        applyTenseRules(words, corrected, i, originalWord);
        applyCommonMistakes(words, corrected, i, originalWord);
        applySpellCheck(words, corrected, i, originalWord);
    }

    // Apply time-based corrections
    corrected = applyTimeBasedTenseCorrection(corrected);

    // Clean up and count corrections
    const finalOutput = corrected.filter(w => w !== "").join(" ");
    corrections = countDifferences(input.toLowerCase(), finalOutput);

    return {
        original: input,
        corrected: finalOutput,
        corrections: corrections,
        appliedRules: appliedRulesList,
        confidence: calculateConfidence(corrections, words.length)
    };
}

// Enhanced article rules
function applyArticleRules(words, corrected, i, originalWord) {
    let word = words[i];
    
    // Rule 1: Article a/an
    if (word === "a" || word === "an") {
        let next = words[i + 1];
        if (next && wordLibrary.rules.vowels.includes(next[0])) {
            if (corrected[i] !== "an") {
                corrected[i] = "an";
                addAppliedRule(`Article correction: "${word}" → "an" before vowel sound`);
            }
        } else {
            if (corrected[i] !== "a") {
                corrected[i] = "a";
                addAppliedRule(`Article correction: "${word}" → "a" before consonant sound`);
            }
        }
    }

    // Rule 2: Remove 'a' before plural noun
    if ((word === "a" || word === "an") && i + 1 < words.length) {
        let next = words[i + 1];
        for (let noun in wordLibrary.nouns) {
            if (wordLibrary.nouns[noun][1] === next) {
                corrected[i] = "";
                addAppliedRule(`Removed article "${word}" before plural noun "${next}"`);
            }
        }
    }
}

// Enhanced verb agreement rules
function applyVerbAgreementRules(words, corrected, i, originalWord) {
    let word = words[i];

    // Rule 3: Subject-Verb Agreement (He/She/It)
    if (["he", "she", "it"].includes(word)) {
        let verb = words[i + 1];
        for (let v in wordLibrary.verbs) {
            if (wordLibrary.verbs[v].base === verb) {
                corrected[i + 1] = wordLibrary.verbs[v].present;
                addAppliedRule(`Subject-verb agreement: "${verb}" → "${wordLibrary.verbs[v].present}" with "${word}"`);
            }
        }
    }

    // Rule 4: Correct "don't" to "doesn't" for third-person singular
    if (["he", "she", "it"].includes(words[i - 1]) && word === "don't") {
        corrected[i] = "doesn't";
        addAppliedRule(`Contraction correction: "don't" → "doesn't" with third-person singular`);
    }

    // Enhanced plural subject rules
    if (["they", "we", "you"].includes(word)) {
        let verb = words[i + 1];
        for (let v in wordLibrary.verbs) {
            if (wordLibrary.verbs[v].present === verb) {
                corrected[i + 1] = wordLibrary.verbs[v].base;
                addAppliedRule(`Plural subject agreement: "${verb}" → "${wordLibrary.verbs[v].base}" with "${word}"`);
            }
        }
    }
}

// Enhanced tense rules
function applyTenseRules(words, corrected, i, originalWord) {
    let word = words[i];

    // Continuous tense correction
    if (["am", "is", "are"].includes(word) && words[i + 1]) {
        let nextWord = words[i + 1];
        for (let v in wordLibrary.verbs) {
            if (wordLibrary.verbs[v].base === nextWord) {
                corrected[i + 1] = wordLibrary.verbs[v].ing;
                addAppliedRule(`Continuous tense: "${nextWord}" → "${wordLibrary.verbs[v].ing}"`);
                break;
            }
        }
    }

    // Future tense with base verb
    if (["will", "shall", "would", "should", "can", "could"].includes(word)) {
        let next = words[i + 1];
        for (let v in wordLibrary.verbs) {
            if (wordLibrary.verbs[v].past === next || wordLibrary.verbs[v].pastParticiple === next) {
                corrected[i + 1] = wordLibrary.verbs[v].base;
                addAppliedRule(`Modal verb correction: "${next}" → "${wordLibrary.verbs[v].base}" after "${word}"`);
            }
        }
    }

    // Present perfect correction
    if (["has", "have"].includes(word)) {
        let next = words[i + 1];
        for (let v in wordLibrary.verbs) {
            if (wordLibrary.verbs[v].base === next) {
                corrected[i + 1] = wordLibrary.verbs[v].pastParticiple;
                addAppliedRule(`Perfect tense: "${next}" → "${wordLibrary.verbs[v].pastParticiple}" with "${word}"`);
            }
        }
    }
}

// Common mistakes correction
function applyCommonMistakes(words, corrected, i, originalWord) {
    let word = words[i];

    // Common verb mistakes
    const commonVerbs = {
        "buyed": "bought",
        "eated": "ate",
        "goed": "went",
        "runned": "ran",
        "catched": "caught",
        "thinked": "thought"
    };

    if (commonVerbs[word]) {
        corrected[i] = commonVerbs[word];
        addAppliedRule(`Common verb correction: "${word}" → "${commonVerbs[word]}"`);
    }

    // Common spelling mistakes
    const commonSpelling = {
        "teh": "the",
        "adn": "and",
        "recieve": "receive",
        "seperate": "separate",
        "definately": "definitely",
        "occured": "occurred",
        "neccessary": "necessary"
    };

    if (commonSpelling[word]) {
        corrected[i] = commonSpelling[word];
        addAppliedRule(`Spelling correction: "${word}" → "${commonSpelling[word]}"`);
    }
}

// Enhanced spell checking
function applySpellCheck(words, corrected, i, originalWord) {
    let word = words[i];
    
    // Check against word library
    if (word.length > 3 && !isWordValid(word)) {
        let suggestion = findClosestWord(word);
        if (suggestion && suggestion !== word) {
            corrected[i] = suggestion;
            addAppliedRule(`Spell check: "${word}" → "${suggestion}"`);
        }
    }

    // Uncountable nouns correction
    if (word === "milks") {
        corrected[i] = "milk";
        addAppliedRule(`Uncountable noun: "milks" → "milk"`);
    }
}

// AI-powered correction using Google Gemini
async function performAICorrection(text, apiKey) {
    const prompt = `Please analyze and correct the following text for grammar, spelling, punctuation, and style. Provide your response in JSON format with the following structure:
{
  "corrected": "the corrected text",
  "errors": [
    {
      "type": "error type (grammar/spelling/punctuation/style)",
      "original": "original text",
      "correction": "corrected text",
      "explanation": "brief explanation"
    }
  ],
  "confidence": 0.95,
  "suggestions": [
    {
      "type": "improvement type",
      "suggestion": "suggestion text"
    }
  ]
}

Text to correct: "${text}"`;

    try {
        const response = await fetch(`${API_CONFIG.gemini.url}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1500,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let aiResponse;
        
        try {
            aiResponse = JSON.parse(data.candidates[0].content.parts[0].text);
        } catch (parseError) {
            // Fallback if JSON parsing fails
            aiResponse = {
                corrected: text,
                errors: [],
                confidence: 0.5,
                suggestions: []
            };
        }

        return {
            original: text,
            corrected: aiResponse.corrected || text,
            errors: aiResponse.errors || [],
            confidence: aiResponse.confidence || 0.8,
            suggestions: aiResponse.suggestions || [],
            source: 'ai'
        };

    } catch (error) {
        console.error('AI correction error:', error);
        throw new Error(`AI correction failed: ${error.message}`);
    }
}

// Utility functions
function isWordValid(word) {
    // Check if word exists in our word library or common words
    return wordLibrary.commonWords.includes(word.toLowerCase()) || 
           Object.keys(wordLibrary.nouns).includes(word) ||
           Object.keys(wordLibrary.verbs).includes(word) ||
           Object.keys(wordLibrary.adjectives).includes(word);
}

function findClosestWord(word) {
    let minDistance = Infinity;
    let closest = word;
    
    // Check against common words
    for (let commonWord of wordLibrary.commonWords) {
        let distance = levenshteinDistance(word, commonWord);
        if (distance < minDistance && distance <= 2) {
            minDistance = distance;
            closest = commonWord;
        }
    }
    
    return closest !== word ? closest : null;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

function addAppliedRule(rule) {
    appliedRulesList.push(rule);
    errorAnalysis.corrections++;
}

function countDifferences(original, corrected) {
    const originalWords = original.split(' ');
    const correctedWords = corrected.split(' ');
    let differences = 0;
    
    for (let i = 0; i < Math.max(originalWords.length, correctedWords.length); i++) {
        if (originalWords[i] !== correctedWords[i]) {
            differences++;
        }
    }
    
    return differences;
}

function calculateConfidence(corrections, totalWords) {
    if (totalWords === 0) return 1;
    const errorRate = corrections / totalWords;
    return Math.max(0.1, 1 - errorRate);
}

// Time-based tense correction (enhanced from original)
function applyTimeBasedTenseCorrection(words) {
    const pastIndicators = ["yesterday", "last", "ago", "previously", "earlier"];
    const futureIndicators = ["tomorrow", "next", "soon", "later", "will"];
    const presentIndicators = ["today", "now", "currently", "presently"];

    let hasPast = words.some(word => pastIndicators.some(indicator => word.includes(indicator)));
    let hasFuture = words.some(word => futureIndicators.some(indicator => word.includes(indicator)));
    let hasPresent = words.some(word => presentIndicators.some(indicator => word.includes(indicator)));

    for (let i = 0; i < words.length; i++) {
        let word = words[i].toLowerCase();
        if (wordLibrary.verbs[word]) {
            let base = wordLibrary.verbs[word].base;
            let verbData = wordLibrary.verbs[base];

            if (hasPast && word !== verbData.past) {
                words[i] = verbData.past;
                addAppliedRule(`Time-based tense: "${word}" → "${verbData.past}" (past indicator found)`);
            } else if (hasPresent && word !== verbData.present) {
                words[i] = verbData.present;
                addAppliedRule(`Time-based tense: "${word}" → "${verbData.present}" (present indicator found)`);
            } else if (hasFuture) {
                if (word !== "will" && words[i - 1] !== "will") {
                    words[i] = "will";
                    words.splice(i + 1, 0, base);
                    addAppliedRule(`Time-based tense: added "will ${base}" (future indicator found)`);
                }
            }
        }
    }

    return words;
}

// Display functions
function displayRuleBasedResults(result) {
    document.getElementById('rulesOutputText').textContent = result.corrected;
    
    const rulesContainer = document.getElementById('appliedRules');
    rulesContainer.innerHTML = '<h4>Applied Rules:</h4>';
    
    if (result.appliedRules.length === 0) {
        rulesContainer.innerHTML += '<p class="no-rules">No corrections needed - text appears to be grammatically correct!</p>';
    } else {
        result.appliedRules.forEach(rule => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'rule-item';
            ruleDiv.innerHTML = `<p>${rule}</p>`;
            rulesContainer.appendChild(ruleDiv);
        });
    }
    
    updateAnalysisStats(result);
}

function displayAIResults(result) {
    document.getElementById('aiOutputText').textContent = result.corrected;
    
    const suggestionsContainer = document.getElementById('aiSuggestions');
    suggestionsContainer.innerHTML = '<h4>AI Analysis:</h4>';
    
    if (result.errors && result.errors.length > 0) {
        const errorsDiv = document.createElement('div');
        errorsDiv.innerHTML = '<h5>Errors Found:</h5>';
        result.errors.forEach(error => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'suggestion-item';
            errorDiv.innerHTML = `
                <h4>${error.type.toUpperCase()}</h4>
                <p><strong>Original:</strong> ${error.original}</p>
                <p><strong>Correction:</strong> ${error.correction}</p>
                <p><strong>Explanation:</strong> ${error.explanation}</p>
            `;
            errorsDiv.appendChild(errorDiv);
        });
        suggestionsContainer.appendChild(errorsDiv);
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.innerHTML = '<h5>Improvement Suggestions:</h5>';
        result.suggestions.forEach(suggestion => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'suggestion-item';
            suggestionDiv.innerHTML = `
                <h4>${suggestion.type.toUpperCase()}</h4>
                <p>${suggestion.suggestion}</p>
            `;
            suggestionsDiv.appendChild(suggestionDiv);
        });
        suggestionsContainer.appendChild(suggestionsDiv);
    }

    if ((!result.errors || result.errors.length === 0) && (!result.suggestions || result.suggestions.length === 0)) {
        suggestionsContainer.innerHTML += '<p class="no-suggestions">Excellent! AI found no issues with your text.</p>';
    }
}

function displayAIFallback(ruleBasedResult) {
    document.getElementById('aiOutputText').textContent = ruleBasedResult.corrected;
    document.getElementById('aiSuggestions').innerHTML = '<h4>AI Correction Unavailable</h4><p>Showing rule-based correction results instead. Add your OpenAI API key to enable AI-powered grammar checking.</p>';
}

function updateAnalysisStats(result) {
    document.getElementById('errorsCount').textContent = result.corrections || 0;
    document.getElementById('correctionsCount').textContent = result.appliedRules ? result.appliedRules.length : 0;
    document.getElementById('readingLevel').textContent = calculateReadingLevel(result.corrected);
    document.getElementById('confidenceScore').textContent = Math.round((result.confidence || 0.8) * 100) + '%';
    
    updateErrorBreakdown(result);
}

function updateAnalysis(ruleResult, aiResult) {
    const combinedErrors = (ruleResult.corrections || 0) + (aiResult.errors ? aiResult.errors.length : 0);
    const combinedCorrections = (ruleResult.appliedRules ? ruleResult.appliedRules.length : 0);
    const confidence = aiResult.confidence || ruleResult.confidence || 0.8;
    
    document.getElementById('errorsCount').textContent = combinedErrors;
    document.getElementById('correctionsCount').textContent = combinedCorrections;
    document.getElementById('readingLevel').textContent = calculateReadingLevel(aiResult.corrected);
    document.getElementById('confidenceScore').textContent = Math.round(confidence * 100) + '%';
    
    updateErrorBreakdownFromAI(aiResult);
}

function updateErrorBreakdown(result) {
    const breakdown = document.getElementById('errorBreakdown');
    breakdown.innerHTML = '<h4>Error Breakdown</h4>';
    
    const errorTypes = {};
    if (result.appliedRules) {
        result.appliedRules.forEach(rule => {
            const type = rule.split(':')[0] || 'Grammar';
            errorTypes[type] = (errorTypes[type] || 0) + 1;
        });
    }
    
    Object.entries(errorTypes).forEach(([type, count]) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-type';
        errorDiv.innerHTML = `
            <span>${type}</span>
            <span class="error-count">${count}</span>
        `;
        breakdown.appendChild(errorDiv);
    });
    
    if (Object.keys(errorTypes).length === 0) {
        breakdown.innerHTML += '<p>No errors detected</p>';
    }
}

function updateErrorBreakdownFromAI(aiResult) {
    const breakdown = document.getElementById('errorBreakdown');
    breakdown.innerHTML = '<h4>Error Breakdown</h4>';
    
    if (aiResult.errors && aiResult.errors.length > 0) {
        const errorTypes = {};
        aiResult.errors.forEach(error => {
            const type = error.type || 'Grammar';
            errorTypes[type] = (errorTypes[type] || 0) + 1;
        });
        
        Object.entries(errorTypes).forEach(([type, count]) => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-type';
            errorDiv.innerHTML = `
                <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span class="error-count">${count}</span>
            `;
            breakdown.appendChild(errorDiv);
        });
    } else {
        breakdown.innerHTML += '<p>No errors detected</p>';
    }
}

function calculateReadingLevel(text) {
    const words = text.split(' ').length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = text.split(' ').reduce((count, word) => {
        return count + countSyllables(word);
    }, 0);
    
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    // Flesch Reading Ease approximation
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    if (score >= 90) return "Very Easy";
    if (score >= 80) return "Easy";
    if (score >= 70) return "Fairly Easy";
    if (score >= 60) return "Standard";
    if (score >= 50) return "Fairly Difficult";
    if (score >= 30) return "Difficult";
    return "Very Difficult";
}

function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
}

// Additional utility functions
function calculateTextStatistics(text) {
    if (!text) return { wordCount: 0, sentenceCount: 0, avgWordLength: 0 };
    
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const totalLetters = words.join('').length;
    
    return {
        wordCount: words.length,
        sentenceCount: sentences.length,
        avgWordLength: words.length > 0 ? totalLetters / words.length : 0
    };
}

function calculateGrammarScore(result) {
    if (!result || !result.original) return 100;
    
    const originalWords = result.original.split(/\s+/).length;
    const errors = (result.corrections || 0) + (result.errors ? result.errors.length : 0);
    
    if (originalWords === 0) return 100;
    
    const errorRate = errors / originalWords;
    const score = Math.max(0, Math.round((1 - errorRate) * 100));
    return Math.min(100, score);
}

// UI Control functions
function showTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.getElementById(tabName + 'Tab').classList.add('active');
    document.getElementById(tabName + 'Content').classList.add('active');
}

function toggleApiConfig() {
    const toggle = document.querySelector('.config-toggle');
    const panel = document.getElementById('configPanel');
    
    toggle.classList.toggle('active');
    panel.classList.toggle('open');
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    const icon = document.getElementById('eyeIcon');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function clearText() {
    document.getElementById('inputText').value = '';
    document.getElementById('resultsSection').style.display = 'none';
    updateWordCount();
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    const button = document.getElementById('checkBtn');
    
    if (show) {
        overlay.classList.add('show');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    } else {
        overlay.classList.remove('show');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-search"></i> Check Grammar';
    }
}

function setStatus(elementId, type, message) {
    const statusElement = document.getElementById(elementId);
    statusElement.className = `status ${type}`;
    statusElement.textContent = message;
}

function showError(message) {
    alert(message); // Could be enhanced with a proper modal
}

function resetResults() {
    appliedRulesList = [];
    errorAnalysis = { total: 0, types: {}, corrections: 0, confidence: 0 };
}

function updateWordCount() {
    const text = document.getElementById('inputText').value;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('wordCount').textContent = `${wordCount} words`;
}

// Enhanced feature functions
let currentSpeech = null;

// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
        localStorage.setItem('theme', 'light');
    }
}

// Copy text functionality
async function copyText(source) {
    const textElement = document.getElementById(source === 'ai' ? 'aiOutputText' : 'rulesOutputText');
    const text = textElement.textContent;
    
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Text copied to clipboard!', 'success');
    } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Text copied to clipboard!', 'success');
    }
}

// Text-to-speech functionality
function speakText(source) {
    const textElement = document.getElementById(source === 'ai' ? 'aiOutputText' : 'rulesOutputText');
    const text = textElement.textContent;
    
    if (!text.trim()) {
        showNotification('No text to speak!', 'warning');
        return;
    }
    
    if (currentSpeech) {
        speechSynthesis.cancel();
        currentSpeech = null;
        updateSpeakButton(source, false);
        return;
    }
    
    if ('speechSynthesis' in window) {
        currentSpeech = new SpeechSynthesisUtterance(text);
        currentSpeech.rate = 0.8;
        currentSpeech.pitch = 1;
        currentSpeech.volume = 0.8;
        
        currentSpeech.onstart = () => updateSpeakButton(source, true);
        currentSpeech.onend = () => {
            currentSpeech = null;
            updateSpeakButton(source, false);
        };
        currentSpeech.onerror = () => {
            currentSpeech = null;
            updateSpeakButton(source, false);
            showNotification('Speech synthesis failed', 'error');
        };
        
        speechSynthesis.speak(currentSpeech);
    } else {
        showNotification('Text-to-speech not supported', 'error');
    }
}

function updateSpeakButton(source, isSpeaking) {
    const buttons = document.querySelectorAll(`#${source}Content .action-btn`);
    const speakButton = Array.from(buttons).find(btn => btn.innerHTML.includes('fa-volume-up') || btn.innerHTML.includes('fa-stop'));
    
    if (speakButton) {
        if (isSpeaking) {
            speakButton.innerHTML = '<i class="fas fa-stop speaking-indicator"></i> Stop';
        } else {
            speakButton.innerHTML = '<i class="fas fa-volume-up"></i> Listen';
        }
    }
}

// Download text functionality
function downloadText(source) {
    const textElement = document.getElementById(source === 'ai' ? 'aiOutputText' : 'rulesOutputText');
    const text = textElement.textContent;
    
    if (!text.trim()) {
        showNotification('No text to download!', 'warning');
        return;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corrected-text-${source}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Text downloaded successfully!', 'success');
}

// Paste from clipboard functionality
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('inputText').value = text;
        updateWordCount();
        showNotification('Text pasted from clipboard!', 'success');
    } catch (error) {
        showNotification('Unable to paste from clipboard. Please paste manually.', 'warning');
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    if (!document.querySelector('.notification-styles')) {
        const style = document.createElement('style');
        style.className = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 2.7s;
                animation-fill-mode: both;
            }
            .notification.success { background: #4CAF50; }
            .notification.error { background: #f44336; }
            .notification.warning { background: #ff9800; }
            .notification.info { background: #2196F3; }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme and word count
    initializeTheme();
    updateWordCount();
    
    // Update word count on input
    document.getElementById('inputText').addEventListener('input', updateWordCount);
    
    // Allow Enter to trigger grammar check (with Ctrl/Cmd)
    document.getElementById('inputText').addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            checkGrammar();
        }
    });
});
