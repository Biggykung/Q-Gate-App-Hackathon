# KID-Q Health Screening

KID-Q is a basic health-screening web app for patient registration, recording UACR results, and managing follow-up queues.

## Features

- Register patients and record health-screening results.
- Categorize UACR results as A1, A2, or A3.
- Review and prioritize patients in the referral dashboard.
- Explore the Kidney Twin lifestyle simulation. Its values are illustrative and are not medical predictions.
- Generate preliminary health information with the Google Gemini API.
- Protect patient pages and API routes with signed sessions and role-based access.

## Technology

- HTML, Tailwind CSS, and JavaScript
- Node.js and Express
- MySQL
- Google Gemini API

## Getting Started

### Requirements

- Node.js 18 or newer
- MySQL
- A Google Gemini API key for AI recommendations

### Setup

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_ADMIN_USER`, and `DB_ADMIN_PASSWORD` to credentials for a MySQL administrator. Add `GEMINI_API_KEY` if AI recommendations are needed.

3. Create the database tables:

   ```bash
   npm run setup-db
   ```

4. Add the patient-portal fields and account relationship (safe to run on an existing database):

   ```bash
   npm run migrate-patient-portal
   ```

5. Create a restricted database account for the app and generate its session secret:

   ```bash
   npm run provision-db-user
   ```

6. Rotate the MySQL administrator password and save the new value in the ignored local `.env` file:

   ```bash
   npm run rotate-db-admin-password
   ```

7. Create the first administrator account:

   ```bash
   npm run bootstrap-admin
   ```

   The initial username and generated password are saved in `.env` as `KIDQ_BOOTSTRAP_USERNAME` and `KIDQ_BOOTSTRAP_PASSWORD`. Keep this file private.

8. Start the app and open [http://localhost:9999/](http://localhost:9999/):

   ```bash
   npm start
   ```

### Accounts and roles

- `admin` can view and manage records, including deleting patients.
- `clinician` can register patients and record screenings.
- `viewer` can register and screen cases they create, use Kidney Twin, and run AI analysis for those cases. Viewers cannot open the referral queue or access other users’ cases.
- `patient` can view only their own latest screening and AI recommendations.

Patients register from `register.html` using a one-time code supplied by their clinician. The code expires after 30 days and activates a patient account linked to only that patient record. For an existing record, a clinician can issue a code from the referral queue. Registrations without a patient code remain inactive until an administrator approves them. Approve a registration from the terminal with `npm run approve-user -- <username> [viewer|clinician]`; accounts default to `viewer`, which can work only with cases created during that session and cannot open the referral queue. Administrators can also create accounts directly with `npm run create-user`.

### Development data and tests

Run `npm test` for the automated checks. To add synthetic demo data to a development database, run `npm run seed-demo`. Do not seed a database containing real patient records.

## Main Pages

- `index.html` — Register patients and record screening results.
- `dashboard.html` — Review the patient queue and UACR categories.
- `kidney-twin.html` — Explore the educational lifestyle simulation.
- `login.html` — Sign in to KID-Q.
- `register.html` — Register a patient or request a staff viewer account.
- `patient.html` — View the signed-in patient’s own screening and AI results.
- `server.js` — REST API and database connection.

> KID-Q is a screening aid, not a diagnostic tool. Treatment decisions should be made by qualified healthcare professionals using confirmed test results.
