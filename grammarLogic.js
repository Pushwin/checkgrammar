
// API Key Configuration - Loaded from config.js
const GROQ_API_KEY = CONFIG.GROQ_API_KEY;

let appliedRulesList = [];
let errorAnalysis = {
    total: 0,
    types: {},
    corrections: 0,
    confidence: 0
};

const API_CONFIG = {
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.1-8b-instant'
    }
};

const GRAMMAR_PATTERNS = {
    subjectVerbPatterns: {
        singular: {
            pronouns: ['he', 'she', 'it', 'this', 'that'],
            verbs: {
                'be': 'is', 'have': 'has', 'do': 'does', 'go': 'goes',
                'say': 'says', 'get': 'gets', 'make': 'makes', 'know': 'knows',
                'think': 'thinks', 'take': 'takes', 'see': 'sees', 'come': 'comes',
                'want': 'wants', 'use': 'uses', 'find': 'finds', 'give': 'gives',
                'tell': 'tells', 'work': 'works', 'call': 'calls', 'try': 'tries'
            }
        },
        plural: {
            pronouns: ['they', 'we', 'you', 'these', 'those'],
            verbs: {
                'is': 'are', 'has': 'have', 'does': 'do', 'goes': 'go',
                'says': 'say', 'gets': 'get', 'makes': 'make', 'knows': 'know',
                'thinks': 'think', 'takes': 'take', 'sees': 'see', 'comes': 'come',
                'wants': 'want', 'uses': 'use', 'finds': 'find', 'gives': 'give',
                'tells': 'tell', 'works': 'work', 'calls': 'call', 'tries': 'try'
            }
        }
    },

    tensePatterns: {
        past: {
            indicators: ['yesterday', 'last week', 'last month', 'last year', 'ago', 'before', 'previously', 'earlier', 'then', 'once upon a time', 'in the past', 'formerly'],
            auxiliaries: ['was', 'were', 'had', 'did']
        },
        present: {
            indicators: ['today', 'now', 'currently', 'at present', 'right now', 'these days', 'nowadays', 'presently'],
            auxiliaries: ['am', 'is', 'are', 'have', 'has', 'do', 'does']
        },
        future: {
            indicators: ['tomorrow', 'next week', 'next month', 'next year', 'soon', 'later', 'eventually', 'in the future'],
            auxiliaries: ['will', 'shall', 'going to', 'about to']
        }
    },

    modalPatterns: {
        modals: ['can', 'could', 'may', 'might', 'will', 'would', 'shall', 'should', 'must', 'ought to'],
        rules: {
            followedByBaseForm: true,
            noDoubleModals: true
        }
    },

    prepositionPatterns: {
        time: {
            'at': ['time', 'night', 'noon', 'midnight', 'dawn', 'dusk'],
            'in': ['morning', 'afternoon', 'evening', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'spring', 'summer', 'autumn', 'winter', 'year', 'month'],
            'on': ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekend']
        },
        place: {
            'at': ['home', 'school', 'work', 'university', 'college'],
            'in': ['city', 'country', 'room', 'house', 'building', 'car'],
            'on': ['street', 'road', 'floor', 'table', 'wall']
        }
    }
};

const COMMON_ERRORS = {
    spelling: {
        'recieve': 'receive', 'seperate': 'separate', 'definately': 'definitely',
        'occured': 'occurred', 'neccessary': 'necessary', 'accomodate': 'accommodate',
        'beleive': 'believe', 'managment': 'management', 'excersise': 'exercise',
        'buisness': 'business', 'successfull': 'successful', 'begining': 'beginning',
        'tommorow': 'tomorrow', 'untill': 'until', 'wich': 'which',
        'teh': 'the', 'adn': 'and', 'hte': 'the', 'thier': 'their',
        'freind': 'friend', 'wierd': 'weird', 'peice': 'piece',
        'calender': 'calendar', 'enviroment': 'environment', 'goverment': 'government'
    },

    grammar: {
        'should of': 'should have', 'could of': 'could have', 'would of': 'would have',
        'might of': 'might have', 'must of': 'must have',
        'alot': 'a lot', 'everyday': 'every day', 'cannot': 'can not',
        'irregardless': 'regardless', 'orientate': 'orient'
    },

    verbForms: {
        'buyed': 'bought', 'catched': 'caught', 'cutted': 'cut', 'drawed': 'drew',
        'eated': 'ate', 'finded': 'found', 'goed': 'went', 'growed': 'grew',
        'hitted': 'hit', 'hurted': 'hurt', 'keeped': 'kept', 'leaved': 'left',
        'loosed': 'lost', 'maked': 'made', 'payed': 'paid', 'putted': 'put',
        'runned': 'ran', 'sayed': 'said', 'seeked': 'sought', 'sended': 'sent',
        'speaked': 'spoke', 'standed': 'stood', 'teached': 'taught', 'thinked': 'thought',
        'throwed': 'threw', 'waked': 'woke', 'winned': 'won', 'writed': 'wrote'
    },

    contractions: {
        'dont': "don't", 'cant': "can't", 'wont': "won't", 'shouldnt': "shouldn't",
        'couldnt': "couldn't", 'wouldnt': "wouldn't", 'isnt': "isn't", 'arent': "aren't",
        'wasnt': "wasn't", 'werent': "weren't", 'hasnt': "hasn't", 'havent': "haven't",
        'hadnt': "hadn't", 'didnt': "didn't", 'doesnt': "doesn't", 'mustnt': "mustn't"
    }
};

async function checkGrammar() {
    const input = document.getElementById("inputText").value.trim();
    
    if (!input) {
        showError("Please enter some text to check.");
        return;
    }

    showLoading(true);
    resetResults();

    try {
        const ruleBasedResult = performComprehensiveCorrection(input);
        displayRuleBasedResults(ruleBasedResult);

        if (GROQ_API_KEY && GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE') {
            try {
                const aiResult = await performGroqAICorrection(input);
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
            setStatus('aiStatus', 'warning', 'Get free API key from console.groq.com');
        }

        document.getElementById('resultsSection').style.display = 'block';

    } catch (error) {
        console.error('Grammar check error:', error);
        showError("An error occurred while checking grammar. Please try again.");
    } finally {
        showLoading(false);
    }
}

async function performGroqAICorrection(text) {
    const prompt = `You are a grammar correction expert. Analyze and correct the following text for grammar, spelling, punctuation, and style. 

Provide your response ONLY as a valid JSON object with this exact structure:
{
  "corrected": "the corrected text here",
  "errors": [
    {
      "type": "grammar",
      "original": "original text",
      "correction": "corrected text",
      "explanation": "brief explanation"
    }
  ],
  "confidence": 0.95,
  "suggestions": [
    {
      "type": "style",
      "suggestion": "suggestion text"
    }
  ]
}

Text to correct: "${text}"

Remember: Respond ONLY with valid JSON, no additional text.`;

    try {
        const response = await fetch(API_CONFIG.groq.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: API_CONFIG.groq.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a professional grammar correction assistant. Always respond with valid JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const aiResponseText = data.choices[0].message.content;
        
        let aiResponse;
        try {
            const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                aiResponse = JSON.parse(jsonMatch[0]);
            } else {
                aiResponse = JSON.parse(aiResponseText);
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', aiResponseText);
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
        console.error('Groq AI correction error:', error);
        throw new Error(`AI correction failed: ${error.message}`);
    }
}

function performComprehensiveCorrection(input) {
    let sentences = splitIntoSentences(input);
    let correctedSentences = [];
    appliedRulesList = [];
    let totalCorrections = 0;

    for (let sentence of sentences) {
        let correctedSentence = correctSentence(sentence);
        correctedSentences.push(correctedSentence.text);
        totalCorrections += correctedSentence.corrections;
    }

    const finalOutput = correctedSentences.join(' ');
    
    return {
        original: input,
        corrected: finalOutput,
        corrections: totalCorrections,
        appliedRules: appliedRulesList,
        confidence: calculateConfidence(totalCorrections, input.split(' ').length)
    };
}

function splitIntoSentences(text) {
    return text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
}

function correctSentence(sentence) {
    let words = tokenizeWords(sentence);
    let corrected = [...words];
    let corrections = 0;

    corrections += applySpellingCorrections(corrected);
    corrections += applyContractionsCorrections(corrected);
    corrections += applyVerbFormCorrections(corrected);
    corrections += applyArticleCorrections(corrected);
    corrections += applySubjectVerbAgreement(corrected);
    corrections += applyTenseConsistency(corrected);
    corrections += applyModalVerbRules(corrected);
    corrections += applyPrepositionRules(corrected);
    corrections += applyCapitalizationRules(corrected);
    corrections += applyPunctuationRules(corrected);
    corrections += applyPluralSingularRules(corrected);
    corrections += applyRedundancyRules(corrected);
    corrections += applyComparativeSuperlativeRules(corrected);
    corrections += applyPronounRules(corrected);

    return {
        text: corrected.filter(w => w !== "").join(" "),
        corrections: corrections
    };
}

function tokenizeWords(sentence) {
    return sentence.toLowerCase()
        .replace(/[.!?;:,]/g, ' $& ')
        .split(/\s+/)
        .filter(w => w.trim().length > 0);
}

function applySpellingCorrections(words) {
    let corrections = 0;
    for (let i = 0; i < words.length; i++) {
        let word = cleanWord(words[i]);
        if (COMMON_ERRORS.spelling[word]) {
            words[i] = words[i].replace(word, COMMON_ERRORS.spelling[word]);
            addAppliedRule(`Spelling: "${word}" → "${COMMON_ERRORS.spelling[word]}"`);
            corrections++;
        }
    }
    return corrections;
}

function applyContractionsCorrections(words) {
    let corrections = 0;
    for (let i = 0; i < words.length; i++) {
        let word = cleanWord(words[i]);
        if (COMMON_ERRORS.contractions[word]) {
            words[i] = words[i].replace(word, COMMON_ERRORS.contractions[word]);
            addAppliedRule(`Contraction: "${word}" → "${COMMON_ERRORS.contractions[word]}"`);
            corrections++;
        }
    }
    return corrections;
}

function applyVerbFormCorrections(words) {
    let corrections = 0;
    for (let i = 0; i < words.length; i++) {
        let word = cleanWord(words[i]);
        if (COMMON_ERRORS.verbForms[word]) {
            words[i] = words[i].replace(word, COMMON_ERRORS.verbForms[word]);
            addAppliedRule(`Verb form: "${word}" → "${COMMON_ERRORS.verbForms[word]}"`);
            corrections++;
        }
        
        if (COMMON_ERRORS.grammar[word]) {
            words[i] = words[i].replace(word, COMMON_ERRORS.grammar[word]);
            addAppliedRule(`Grammar: "${word}" → "${COMMON_ERRORS.grammar[word]}"`);
            corrections++;
        }
    }
    return corrections;
}

function applyArticleCorrections(words) {
    let corrections = 0;
    for (let i = 0; i < words.length; i++) {
        let word = cleanWord(words[i]);
        
        if (word === 'a' || word === 'an') {
            let nextWord = i + 1 < words.length ? cleanWord(words[i + 1]) : '';
            if (nextWord && isVowelSound(nextWord)) {
                if (word !== 'an') {
                    words[i] = words[i].replace(word, 'an');
                    addAppliedRule(`Article: "a" → "an" before vowel sound`);
                    corrections++;
                }
            } else if (nextWord) {
                if (word !== 'a') {
                    words[i] = words[i].replace(word, 'a');
                    addAppliedRule(`Article: "an" → "a" before consonant sound`);
                    corrections++;
                }
            }
        }

        if ((word === 'a' || word === 'an') && i + 1 < words.length) {
            let nextWord = cleanWord(words[i + 1]);
            if (isPluralNoun(nextWord)) {
                words[i] = '';
                addAppliedRule(`Removed article before plural noun "${nextWord}"`);
                corrections++;
            }
        }
    }
    return corrections;
}

function applySubjectVerbAgreement(words) {
    let corrections = 0;
    
    for (let i = 0; i < words.length - 1; i++) {
        let subject = cleanWord(words[i]);
        let verb = cleanWord(words[i + 1]);
        
        if (GRAMMAR_PATTERNS.subjectVerbPatterns.singular.pronouns.includes(subject)) {
            let correctVerb = getCorrectVerbForm(verb, 'singular');
            if (correctVerb && correctVerb !== verb) {
                words[i + 1] = words[i + 1].replace(verb, correctVerb);
                addAppliedRule(`Subject-verb agreement: "${verb}" → "${correctVerb}" with "${subject}"`);
                corrections++;
            }
        }
        
        if (GRAMMAR_PATTERNS.subjectVerbPatterns.plural.pronouns.includes(subject)) {
            let correctVerb = getCorrectVerbForm(verb, 'plural');
            if (correctVerb && correctVerb !== verb) {
                words[i + 1] = words[i + 1].replace(verb, correctVerb);
                addAppliedRule(`Subject-verb agreement: "${verb}" → "${correctVerb}" with "${subject}"`);
                corrections++;
            }
        }

        if (['he', 'she', 'it'].includes(subject) && verb === "don't") {
            words[i + 1] = words[i + 1].replace("don't", "doesn't");
            addAppliedRule(`Contraction agreement: "don't" → "doesn't" with third person singular`);
            corrections++;
        }
    }
    
    return corrections;
}

function applyTenseConsistency(words) {
    let corrections = 0;
    let detectedTense = detectTense(words);
    
    if (detectedTense) {
        for (let i = 0; i < words.length; i++) {
            let word = cleanWord(words[i]);
            if (wordLibrary.verbs[word]) {
                let correctForm = getCorrectTenseForm(word, detectedTense);
                if (correctForm && correctForm !== word) {
                    words[i] = words[i].replace(word, correctForm);
                    addAppliedRule(`Tense consistency: "${word}" → "${correctForm}" (${detectedTense} tense)`);
                    corrections++;
                }
            }
        }
    }
    
    return corrections;
}

function applyModalVerbRules(words) {
    let corrections = 0;
    
    for (let i = 0; i < words.length - 1; i++) {
        let word = cleanWord(words[i]);
        if (GRAMMAR_PATTERNS.modalPatterns.modals.includes(word)) {
            let nextWord = cleanWord(words[i + 1]);
            
            if (wordLibrary.verbs[nextWord]) {
                let baseForm = wordLibrary.verbs[nextWord].base || nextWord;
                if (baseForm !== nextWord) {
                    words[i + 1] = words[i + 1].replace(nextWord, baseForm);
                    addAppliedRule(`Modal verb: "${nextWord}" → "${baseForm}" after "${word}"`);
                    corrections++;
                }
            }
            
            if (GRAMMAR_PATTERNS.modalPatterns.modals.includes(nextWord)) {
                words[i] = '';
                addAppliedRule(`Removed double modal: "${word} ${nextWord}" → "${nextWord}"`);
                corrections++;
            }
        }
    }
    
    return corrections;
}

function applyPrepositionRules(words) {
    let corrections = 0;
    
    for (let i = 0; i < words.length - 1; i++) {
        let prep = cleanWord(words[i]);
        let nextWord = cleanWord(words[i + 1]);
        
        if (['at', 'in', 'on'].includes(prep)) {
            let correctPrep = getCorrectTimePreposition(nextWord);
            if (correctPrep && correctPrep !== prep && isTimeWord(nextWord)) {
                words[i] = words[i].replace(prep, correctPrep);
                addAppliedRule(`Preposition: "${prep}" → "${correctPrep}" with time "${nextWord}"`);
                corrections++;
            }
            
            let correctPlacePrep = getCorrectPlacePreposition(nextWord);
            if (correctPlacePrep && correctPlacePrep !== prep && isPlaceWord(nextWord)) {
                words[i] = words[i].replace(prep, correctPlacePrep);
                addAppliedRule(`Preposition: "${prep}" → "${correctPlacePrep}" with place "${nextWord}"`);
                corrections++;
            }
        }
    }
    
    return corrections;
}

function applyCapitalizationRules(words) {
    let corrections = 0;
    
    if (words.length > 0) {
        let firstWord = words[0];
        let capitalizedFirst = capitalizeFirstLetter(firstWord);
        if (capitalizedFirst !== firstWord) {
            words[0] = capitalizedFirst;
            addAppliedRule(`Capitalization: First word capitalized`);
            corrections++;
        }
    }
    
    for (let i = 0; i < words.length; i++) {
        if (cleanWord(words[i]) === 'i' && !isPunctuation(words[i])) {
            words[i] = words[i].replace('i', 'I');
            addAppliedRule(`Capitalization: "i" → "I"`);
            corrections++;
        }
    }
    
    return corrections;
}

function applyPunctuationRules(words) {
    let corrections = 0;
    
    let lastWord = words[words.length - 1];
    if (lastWord && !endsWithPunctuation(lastWord)) {
        words[words.length - 1] = lastWord + '.';
        addAppliedRule(`Punctuation: Added period at sentence end`);
        corrections++;
    }
    
    return corrections;
}

function applyPluralSingularRules(words) {
    let corrections = 0;
    
    for (let i = 0; i < words.length; i++) {
        let word = cleanWord(words[i]);
        
        if (isUncountableNoun(word) && word.endsWith('s')) {
            let singular = word.slice(0, -1);
            words[i] = words[i].replace(word, singular);
            addAppliedRule(`Uncountable noun: "${word}" → "${singular}"`);
            corrections++;
        }
    }
    
    return corrections;
}

function applyRedundancyRules(words) {
    let corrections = 0;
    
    for (let i = 0; i < words.length - 1; i++) {
        if (cleanWord(words[i]) === cleanWord(words[i + 1]) && !isPunctuation(words[i])) {
            words[i + 1] = '';
            addAppliedRule(`Removed duplicate word: "${cleanWord(words[i])}"`);
            corrections++;
        }
    }
    
    return corrections;
}

function applyComparativeSuperlativeRules(words) {
    let corrections = 0;
    
    for (let i = 0; i < words.length; i++) {
        let word = cleanWord(words[i]);
        
        if (word === 'more' && i + 1 < words.length) {
            let nextWord = cleanWord(words[i + 1]);
            if (nextWord.endsWith('er') || ['better', 'worse'].includes(nextWord)) {
                words[i] = '';
                addAppliedRule(`Double comparative: "more ${nextWord}" → "${nextWord}"`);
                corrections++;
            }
        }
        
        if (word === 'most' && i + 1 < words.length) {
            let nextWord = cleanWord(words[i + 1]);
            if (nextWord.endsWith('est') || ['best', 'worst'].includes(nextWord)) {
                words[i] = '';
                addAppliedRule(`Double superlative: "most ${nextWord}" → "${nextWord}"`);
                corrections++;
            }
        }
    }
    
    return corrections;
}

function applyPronounRules(words) {
    let corrections = 0;
    
    const pronounCorrections = {
        'me and him': 'he and I',
        'him and me': 'he and I',
        'me and her': 'she and I',
        'her and me': 'she and I'
    };
    
    for (let i = 0; i < words.length - 2; i++) {
        let phrase = [words[i], words[i + 1], words[i + 2]].map(cleanWord).join(' ');
        if (pronounCorrections[phrase]) {
            words[i] = pronounCorrections[phrase].split(' ')[0];
            words[i + 1] = pronounCorrections[phrase].split(' ')[1];
            words[i + 2] = pronounCorrections[phrase].split(' ')[2];
            addAppliedRule(`Pronoun case: "${phrase}" → "${pronounCorrections[phrase]}"`);
            corrections++;
        }
    }
    
    return corrections;
}


function cleanWord(word) {
    return word.replace(/[.!?;:,]/g, '').toLowerCase();
}

function isVowelSound(word) {
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    const vowelSoundExceptions = {
        'honest': true, 'hour': true, 'honor': true, 'herb': true,
        'university': false, 'user': false, 'united': false, 'european': false
    };
    
    if (vowelSoundExceptions.hasOwnProperty(word)) {
        return vowelSoundExceptions[word];
    }
    
    return vowels.includes(word[0]);
}

function isPluralNoun(word) {
    for (let noun in wordLibrary.nouns) {
        if (wordLibrary.nouns[noun][1] === word) {
            return true;
        }
    }
    
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
        let singular = word.slice(0, -1);
        return wordLibrary.nouns[singular] !== undefined;
    }
    
    return false;
}

function getCorrectVerbForm(verb, number) {
    for (let baseVerb in wordLibrary.verbs) {
        let verbData = wordLibrary.verbs[baseVerb];
        
        if (verb === baseVerb || 
            verb === verbData.present || 
            verb === verbData.past || 
            verb === verbData.pastParticiple || 
            verb === verbData.ing) {
            
            if (number === 'singular') {
                return verbData.present;
            } else {
                return verbData.base;
            }
        }
    }
    
    if (number === 'singular' && !verb.endsWith('s')) {
        return verb + 's';
    } else if (number === 'plural' && verb.endsWith('s')) {
        return verb.slice(0, -1);
    }
    
    return null;
}

function detectTense(words) {
    let pastScore = 0, presentScore = 0, futureScore = 0;
    
    for (let word of words) {
        let cleanedWord = word.toLowerCase();
        
        if (GRAMMAR_PATTERNS.tensePatterns.past.indicators.some(ind => cleanedWord.includes(ind))) {
            pastScore += 2;
        }
        if (GRAMMAR_PATTERNS.tensePatterns.present.indicators.some(ind => cleanedWord.includes(ind))) {
            presentScore += 2;
        }
        if (GRAMMAR_PATTERNS.tensePatterns.future.indicators.some(ind => cleanedWord.includes(ind))) {
            futureScore += 2;
        }
        
        if (GRAMMAR_PATTERNS.tensePatterns.past.auxiliaries.includes(cleanedWord)) {
            pastScore += 1;
        }
        if (GRAMMAR_PATTERNS.tensePatterns.present.auxiliaries.includes(cleanedWord)) {
            presentScore += 1;
        }
        if (GRAMMAR_PATTERNS.tensePatterns.future.auxiliaries.includes(cleanedWord)) {
            futureScore += 1;
        }
    }
    
    let maxScore = Math.max(pastScore, presentScore, futureScore);
    if (maxScore > 1) {
        if (pastScore === maxScore) return 'past';
        if (presentScore === maxScore) return 'present';
        if (futureScore === maxScore) return 'future';
    }
    
    return null;
}

function getCorrectTenseForm(verb, tense) {
    for (let baseVerb in wordLibrary.verbs) {
        let verbData = wordLibrary.verbs[baseVerb];
        
        if (verb === baseVerb || 
            verb === verbData.present || 
            verb === verbData.past || 
            verb === verbData.pastParticiple || 
            verb === verbData.ing) {
            
            switch (tense) {
                case 'past': return verbData.past;
                case 'present': return verbData.present || verbData.base;
                case 'future': return verbData.base;
                default: return null;
            }
        }
    }
    
    return null;
}

function getCorrectTimePreposition(timeWord) {
    for (let prep in GRAMMAR_PATTERNS.prepositionPatterns.time) {
        if (GRAMMAR_PATTERNS.prepositionPatterns.time[prep].includes(timeWord)) {
            return prep;
        }
    }
    return null;
}

function getCorrectPlacePreposition(placeWord) {
    for (let prep in GRAMMAR_PATTERNS.prepositionPatterns.place) {
        if (GRAMMAR_PATTERNS.prepositionPatterns.place[prep].includes(placeWord)) {
            return prep;
        }
    }
    return null;
}

function isTimeWord(word) {
    return Object.values(GRAMMAR_PATTERNS.prepositionPatterns.time)
        .flat().includes(word);
}

function isPlaceWord(word) {
    return Object.values(GRAMMAR_PATTERNS.prepositionPatterns.place)
        .flat().includes(word);
}

function capitalizeFirstLetter(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function isPunctuation(word) {
    return /^[.!?;:,]+$/.test(word);
}

function endsWithPunctuation(word) {
    return /[.!?]$/.test(word);
}

function isUncountableNoun(word) {
    const uncountableNouns = [
        'water', 'milk', 'coffee', 'tea', 'juice', 'beer', 'wine',
        'rice', 'bread', 'meat', 'cheese', 'butter', 'sugar', 'salt',
        'money', 'time', 'information', 'knowledge', 'advice', 'news',
        'music', 'art', 'love', 'happiness', 'anger', 'fear',
        'furniture', 'equipment', 'luggage', 'homework', 'work',
        'weather', 'traffic', 'pollution', 'research', 'progress'
    ];
    return uncountableNouns.includes(word.replace(/s$/, ''));
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; i <= str1.length; j++) {
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

function calculateConfidence(corrections, totalWords) {
    if (totalWords === 0) return 1;
    const errorRate = corrections / totalWords;
    const confidence = Math.max(0.1, 1 - (errorRate * 0.5));
    return Math.min(1, confidence);
}

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
    document.getElementById('aiSuggestions').innerHTML = '<h4>AI Correction Unavailable</h4><p>Get your FREE API key from <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a> and paste it at the top of grammarLogic.js file.</p>';
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

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.getElementById(tabName + 'Tab').classList.add('active');
    document.getElementById(tabName + 'Content').classList.add('active');
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
    alert(message);
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

document.addEventListener('DOMContentLoaded', function() {
    updateWordCount();
    
    document.getElementById('inputText').addEventListener('input', updateWordCount);
    
    document.getElementById('inputText').addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            checkGrammar();
        }
    });
});
