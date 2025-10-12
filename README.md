# Advanced Grammar Checker with AI

[![Live Site](https://img.shields.io/badge/Live-Demo-blue)](https://checkgrammar.onrender.com)

A comprehensive grammar checker website with AI-powered corrections and rule-based analysis.

## Features

- **AI-Powered Corrections**: Uses Groq's free API for intelligent grammar checking
- **Rule-Based Analysis**: Comprehensive grammar rules for spelling, punctuation, and style
- **Real-time Analysis**: Instant feedback with detailed error breakdown
- **Multiple Output Formats**: Copy, download, or listen to corrected text
- **Reading Level Assessment**: Analyzes text complexity and readability

## Setup Instructions

### 1. Get Your Free API Key

1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up for a free account
3. Generate a new API key

### 2. Configure the Application

**Option A: Direct Configuration (for local development)**
1. Open `grammarLogic.js`
2. Replace `YOUR_GROQ_API_KEY_HERE` on line 6 with your actual API key

**Option B: Environment Variables (recommended for production)**
1. Create a `.env` file in the project root
2. Add your API key: `GROQ_API_KEY=your_actual_api_key_here`
3. The `.env` file is already included in `.gitignore` for security

### 3. Security Note

⚠️ **Important**: Never commit your actual API key to version control. The `.env` file is already added to `.gitignore` to prevent accidental exposure.

## Usage

1. Open `index.html` in your web browser
2. Enter text in the input field
3. Click "Check Grammar" to analyze your text
4. View results in three tabs:
   - **AI Correction**: AI-powered suggestions and corrections
   - **Rule-based Correction**: Traditional grammar rule corrections
   - **Analysis**: Detailed statistics and error breakdown

## API Key Security

If you accidentally exposed your API key:
1. **Immediately revoke it** in the Groq console
2. Generate a new API key
3. Update your configuration with the new key

## Technologies Used

- Vanilla JavaScript
- Groq API (Free tier)
- HTML5 & CSS3
- Font Awesome icons
