# Tournament & Ticket Shop Manager Discord Addon

An addon feature for Discord bots that provides a comprehensive **Tournament and Ticket Shop Manager**. This addon enables server administrators to configure ticket options, open/close event ticket shops, manage multi-purchase rules, handle user ticket redemptions for events like **"Bonus Hunt - Slot Call"**, and enforce **60% fuzzy string matching** to eliminate duplicate slot game calls.

---

## 🌟 Key Features

1. **Admin Control Panel (`/ticketshop`)**:
   - **Open Ticket Shop**: Brings up a selection window with each configured ticket option to select which event the shop is opening for.
   - **Close Ticket Shop**: Closes ticket sales & redemptions, archiving the master list.
   - **Add Ticket Modal**: Form to enter `Event Name`, `Ticket Cost`, `Brief Description`, and `Allow Multiples` toggle.
     - If *Allow Multiples* is `Yes`, users can buy multiple tickets.
     - If *Allow Multiples* is `No`, users are strictly limited to **maximum 5 tickets**.
   - **Remove Ticket**: Select menu to delete ticket templates.
   - **View Master List**: Displays full event registration list (`@username`, Slot Game Name, Bonus Type: Super/Normal, Timestamp).

2. **User Shop & Redemption Flow (`/shop`)**:
   - Check ticket balance and purchase tickets.
   - Click **Redeem Ticket for Event** to register for active events (e.g. *Bonus Hunt - Slot Call*).
   - Modal form asks for:
     - `Slot Game Name` on stake.com.
     - `Bonus Type` (`Super` or `Normal`).

3. **Intelligent 60% Fuzzy Slot Game Matcher**:
   - Calculates string similarity (Sørensen-Dice coefficient + Levenshtein distance).
   - If an entered slot game is $\ge 60\%$ similar to an already registered game:
     - Shows an interactive prompt: *"Is '[User Input]' the same game as '[Existing Entry]'?"*
     - If user selects **Yes**: Entry is rejected, ticket is not spent, and user is prompted to enter another slot game.
     - If user selects **No**: Entry is accepted, ticket is deducted, confirmation message is shown, and entry is added to the event Master List.

4. **Master Entry List**:
   - Fresh master list created every time the shop is opened for a new event.
   - Captures `@username`, user ID, slot game name, super/normal choice, and timestamp.

---

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and add your bot credentials:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_guild_id_here (optional, for instant guild slash command registration)
```

### 3. Start the Bot
```bash
npm start
```

---

## 📁 File Structure

- `index.js`: Main bot entry point, slash command registration, and interaction routing.
- `ticketShopManager.js`: Core data manager for ticket templates, balances, active shop state, and master lists (`tickets_data.json`).
- `adminPanel.js`: Admin `/ticketshop` embed generators, modals, and dropdown components.
- `userPanel.js`: User `/shop` embed generators, slot redemption forms, and duplicate confirmation handlers.
- `fuzzyMatcher.js`: Sørensen-Dice + Levenshtein string similarity calculator (60% threshold).
- `testFuzzy.js`: Test script verifying game title similarity logic.

---

## 🛠️ Usage Instructions

1. Admin types `/ticketshop` to open the Admin Control Panel.
2. Click **Add Ticket** to create a template (e.g. Event Name: `Bonus Hunt - Slot Call`, Cost: `1`, Description: `Pick a slot on Stake.com`, Multiples: `no`).
3. Click **Open Ticket Shop** and select `Bonus Hunt - Slot Call`.
4. Users run `/shop` to buy tickets and click **Redeem Ticket for Event**.
5. When a user redeems, they enter their Stake.com slot game and select Super/Normal.
6. The system checks against the master list for $\ge 60\%$ matches, asks confirmation if a match is found, deducts the ticket upon approval, and adds `@username` and slot pick to the master list.
