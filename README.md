# KID-Q Health Screening

KID-Q is a web app for kidney-health screening workflows. It supports patient registration, screening records, UACR-based referral prioritization, AI-generated educational guidance, and a patient portal.

## Features

- Register patients and record screening results.
- Classify UACR risk into A1, A2, or A3 categories and review follow-up cases in the Referral Queue.
- Use Kidney Twin to explore how lifestyle changes may affect illustrative kidney-health indicators. The simulation is educational, not predictive.
- Generate preliminary guidance with the Google Gemini API.
- Give patients access to their own latest screening and AI recommendations through an account linked to their patient record.
- Restrict pages and API actions by role.

## Technology

- HTML, Tailwind CSS, and JavaScript
- Node.js and Express
- MySQL
- Google Gemini API (optional)

## Requirements

- Node.js 18 or newer
- MySQL
- A Google Gemini API key if AI recommendations are required

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Set your MySQL host and administrator credentials. The included SQL setup scripts currently use the `health_gate` database, so keep `DB_NAME=health_gate`. Set `GEMINI_API_KEY` to enable AI recommendations.

   In PowerShell, you can copy the example with:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Create the database tables:

   ```bash
   npm run setup-db
   ```

   For an existing database created before the patient portal was added, apply its migration:

   ```bash
   npm run migrate-patient-portal
   ```

4. Create a restricted MySQL account for the app. This also generates `DB_USER`, `DB_PASSWORD`, and `SESSION_SECRET` in your local `.env` file:

   ```bash
   npm run provision-db-user
   ```

5. Create the first administrator account:

   ```bash
   npm run bootstrap-admin
   ```

   The generated username and password are stored in `.env` as `KIDQ_BOOTSTRAP_USERNAME` and `KIDQ_BOOTSTRAP_PASSWORD`. Sign in and keep these credentials private.

6. Start KID-Q and open [http://localhost:9999/](http://localhost:9999/):

   ```bash
   npm start
   ```

Keep `.env` private and never commit it. You can optionally rotate the MySQL administrator password with `npm run rotate-db-admin-password`; this changes that MySQL account’s password and updates the local `.env` file.

## Accounts and roles

| Role | Access |
| --- | --- |
| `admin` | Review and manage records, including deleting patients. |
| `clinician` | Register and screen patients, review the Referral Queue, and issue patient-portal codes. |
| `viewer` | Register and screen cases they create, use Kidney Twin, and request AI analysis for those cases. Cannot access the Referral Queue or other users’ cases. |
| `patient` | View only their own latest screening and AI recommendations. |

Patients create an account from `register.html` with a one-time code supplied by clinic staff. The code expires after 30 days and can be used once. Staff can issue a code for an existing patient from the Referral Queue. Staff registrations without a patient code remain inactive until approved by an administrator.

Approve a pending staff account from a terminal:

```bash
npm run approve-user -- <username> [viewer|clinician]
```

The role defaults to `viewer`. Administrators can create an active staff account directly with `npm run create-user`.

## Development

Run the automated checks with:

```bash
npm test
```

To add clearly labelled synthetic sample data to a development database:

```bash
npm run seed-demo
```

Do not seed a database containing real patient records.

## Main pages

- `index.html` — Register patients and record screening results.
- `dashboard.html` — Review the Referral Queue and UACR categories.
- `kidney-twin.html` — Explore the educational lifestyle simulation.
- `login.html` — Sign in.
- `register.html` — Register a patient or request a staff account.
- `patient.html` — View the signed-in patient’s own screening and AI results.
- `server.js` — Express server and API routes.

> KID-Q supports screening workflows and provides educational information. It is not a diagnostic tool. Qualified healthcare professionals should make clinical decisions using confirmed test results.
