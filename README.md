# KID-Q Health Screening

KID-Q is a basic health-screening web app for patient registration, recording UACR results, and managing follow-up queues.

## Features

- Register patients and record health-screening results.
- Categorize UACR results as A1, A2, or A3.
- Review and prioritize patients in the referral dashboard.
- Explore the Kidney Twin lifestyle simulation. Its values are illustrative and are not medical predictions.
- Generate preliminary health information with the Google Gemini API.

## Technology

- HTML, Tailwind CSS, and JavaScript
- Node.js and Express
- MySQL
- Google Gemini API

## Getting Started

### Requirements

- Node.js
- MySQL
- A Google Gemini API key for AI recommendations

### Setup

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Configure the environment variables in `.env` using `.env.example` as a reference. If `.env` already exists, keep its current `GEMINI_API_KEY` and add the database settings.
3. Create the `health_gate` database and the tables used by the API: `patients`, `health_screening`, and `ai_recommendations`.
4. Start the backend:

   ```bash
   npm start
   ```

5. Open [http://localhost:9999/](http://localhost:9999/) in your browser.

The required environment variables are `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `GEMINI_API_KEY`. Keep real credentials in `.env`; do not commit them to Git.

## Main Pages

- `index.html` — Register patients and record screening results.
- `dashboard.html` — Review the patient queue and UACR categories.
- `kidney-twin.html` — Explore the educational lifestyle simulation.
- `server.js` — REST API and database connection.

> KID-Q is a screening aid, not a diagnostic tool. Treatment decisions should be made by qualified healthcare professionals using confirmed test results.
