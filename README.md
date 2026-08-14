
# ServiceHub Frontend

---

## Tech Stack

- Vue 3 (Composition API)
- Vite (build tool)
- JavaScript (ES6+)
- CSS (custom styling)
- Node.js & npm

---
---

## How to Run the Frontend

### 1. Install Node.js

Make sure Node.js is installed:

```bash
node -v
npm -v 
```
### 2. cd servicehub
### 3. npm install
### 4. npm run dev

Run Vite URL into your web browser

---


# ServiceHub Database

## Prerequisites
- [DBeaver](https://dbeaver.io/download/) installed (or any database management tool)

---

## First-Time Setup

1. Open DBeaver
2. Click **New Database Connection** (plug icon in top left)
3. Select **MySQL** → click **Next**
4. Fill in the fields:

| Field | Value |
|---|---|
| Host | provided by host |
| Port | provided by host |
| Database | `service_marketplace` |
| Username | database username (sent by the host) |
| Password | database password (sent by the host) |

5. Click **Test Connection** — if it says OK, click **Finish**

---

## Every Time the Host Restarts Ngrok

The host and port change on every restart. To update your connection:

1. Right click your existing connection in DBeaver
2. Click **Edit Connection**
3. Update **Host** and **Port** with the new values from the group chat
4. Click **Finish**

---

