# 🏥 Q-Gate App (Quantum Quest Health Gate)

A full-stack, offline-first health screening web application designed for early kidney disease risk assessment. Built as an MVP for a Hackathon, this tool streamlines medical clinical workflows, integrates mockup AI image processing, and manages patient referrals efficiently.

## 📑 Table of Contents
- [About This Project](#about-this-project)
- [Key Features Snapshot](#key-features-snapshot)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Repository Structure](#repository-structure)

---

## 💡 About This Project

This repository contains the end-to-end implementation of **Q-Gate**, a screening tool for medical personnel. The system follows a rigorous clinical workflow: **Patient Registration → AI Guided Capture (UACR Risk Assessment) → Actionable Routing via Smart Dashboard**. 

The work demonstrates proficiency in full-stack web development, RESTful API design, relational database integrity (Foreign Keys & Cascading Deletes), and UI/UX design tailored for healthcare professionals.

---

## 🎯 Key Features Snapshot

| Feature | Domain | Core Functionality |
| :--- | :--- | :--- |
| **📸 AI Guided Capture** | Computer Vision (Mockup) | Validates image quality (Control Spots, Exposure, Blur) before extracting UACR values to prevent false results. |
| **🧮 Risk Assessment** | Medical Logic | Automatically categorizes UACR risk into A1 (Normal), A2 (Monitor), and A3 (High Risk) based on KDIGO standards. |
| **📊 Smart Dashboard** | Healthcare Admin | Dynamic patient queue management with CRUD operations, automated color-coding, and referral routing. |
| **🔒 Data Integrity** | Database Architecture | Relational architecture with strict Foreign Key constraints ensuring zero orphaned records upon patient deletion. |

---

## 💻 Technology Stack

**Core Languages & Tools**
| Tool | Purpose |
| :--- | :--- |
| **Vanilla JavaScript** | Core frontend logic, DOM manipulation, and API integration. |
| **HTML5 & Tailwind CSS** | Utility-first, responsive user interface design. |
| **Node.js & Express.js** | Backend server, routing, and RESTful API endpoints. |
| **MySQL** | Relational database management. |
| **Git & GitHub** | Version control and repository hosting. |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v14.0 or higher)
* **MySQL Server** (Local or Cloud)

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone [https://github.com/Biggykung/Q-Gate-App-Hackathon.git](https://github.com/Biggykung/Q-Gate-App-Hackathon.git)
   cd Q-Gate-App-Hackathon
