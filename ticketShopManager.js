const fs = require('fs');
const path = require('path');
const { searchSlots } = require('./stakeScraper');

const DATA_FILE = path.join(__dirname, 'tickets_data.json');

const defaultData = {
  ticketTemplates: {}, // id: { id, name, cost, description, allowMultiples, maxLimit }
  userBalances: {},    // userId: { ticketTypeId: count }
  pendingTipInvoices: {}, // invoiceId: { userId, ticketTypeId, amount, cost, botUsername, createdAt, status }
  activeShop: null,    // { eventName, ticketTypeId, openedAt, masterList: [] }
  archivedEvents: []   // Array of closed event master lists
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading tickets_data.json:', err);
  }
  saveData(defaultData);
  return defaultData;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing tickets_data.json:', err);
  }
}

class TicketShopManager {
  constructor() {
    this.data = loadData();
  }

  // --- Ticket Templates ---
  addTicketTemplate(name, cost, description, allowMultiples) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const template = {
      id,
      name,
      cost: Number(cost),
      description,
      allowMultiples: Boolean(allowMultiples),
      maxLimit: allowMultiples ? null : 5
    };
    this.data.ticketTemplates[id] = template;
    saveData(this.data);
    return template;
  }

  removeTicketTemplate(id) {
    if (this.data.ticketTemplates[id]) {
      delete this.data.ticketTemplates[id];
      saveData(this.data);
      return true;
    }
    return false;
  }

  getTicketTemplates() {
    return Object.values(this.data.ticketTemplates);
  }

  getTicketTemplate(id) {
    return this.data.ticketTemplates[id];
  }

  // --- Shop & Event Management ---
  openShop(ticketTypeId) {
    const template = this.getTicketTemplate(ticketTypeId);
    if (!template) return false;

    this.data.activeShop = {
      eventName: template.name,
      ticketTypeId: template.id,
      description: template.description,
      cost: template.cost,
      allowMultiples: template.allowMultiples,
      openedAt: new Date().toISOString(),
      masterList: [] // Fresh master list created every time shop opens
    };
    saveData(this.data);
    return this.data.activeShop;
  }

  closeShop() {
    if (!this.data.activeShop) return null;
    const closedEvent = { ...this.data.activeShop, closedAt: new Date().toISOString() };
    this.data.archivedEvents.push(closedEvent);
    this.data.activeShop = null;
    saveData(this.data);
    return closedEvent;
  }

  getActiveShop() {
    return this.data.activeShop;
  }

  // --- User Balances & Tip Payments ---
  getUserBalance(userId, ticketTypeId) {
    if (!this.data.userBalances[userId]) return 0;
    return this.data.userBalances[userId][ticketTypeId] || 0;
  }

  // Creates pending tip invoice when user initiates ticket purchase
  createTipInvoice(userId, ticketTypeId, botUsername, amount = 1) {
    const template = this.getTicketTemplate(ticketTypeId);
    if (!template) return null;

    const currentBalance = this.getUserBalance(userId, ticketTypeId);
    if (!template.allowMultiples && (currentBalance + amount > template.maxLimit)) {
      return { error: `Purchase limit reached! You cannot hold more than ${template.maxLimit} tickets for this event.` };
    }

    const invoiceId = `inv_${userId}_${Date.now()}`;
    const invoice = {
      invoiceId,
      userId,
      ticketTypeId,
      eventName: template.name,
      cost: template.cost * amount,
      amount,
      botUsername,
      createdAt: new Date().toISOString(),
      status: 'pending' // 'pending', 'confirmed', 'cancelled'
    };

    this.data.pendingTipInvoices[invoiceId] = invoice;
    saveData(this.data);
    return invoice;
  }

  // Confirms tip payment and credits tickets to user
  confirmTipInvoice(invoiceId) {
    const invoice = this.data.pendingTipInvoices[invoiceId];
    if (!invoice || invoice.status !== 'pending') return false;

    invoice.status = 'confirmed';
    invoice.confirmedAt = new Date().toISOString();

    const current = this.getUserBalance(invoice.userId, invoice.ticketTypeId);
    if (!this.data.userBalances[invoice.userId]) {
      this.data.userBalances[invoice.userId] = {};
    }
    this.data.userBalances[invoice.userId][invoice.ticketTypeId] = current + invoice.amount;
    saveData(this.data);

    return {
      success: true,
      userId: invoice.userId,
      eventName: invoice.eventName,
      newBalance: this.data.userBalances[invoice.userId][invoice.ticketTypeId]
    };
  }

  deductTicketFromUser(userId, ticketTypeId, amount = 1) {
    const current = this.getUserBalance(userId, ticketTypeId);
    if (current < amount) {
      return false;
    }
    this.data.userBalances[userId][ticketTypeId] = current - amount;
    saveData(this.data);
    return true;
  }

  // --- Master List ---
  addEntryToMasterList(userId, username, slotGame, bonusType) {
    if (!this.data.activeShop) return false;

    const entry = {
      userId,
      username,
      slotGame,
      bonusType,
      timestamp: new Date().toISOString()
    };

    this.data.activeShop.masterList.push(entry);
    saveData(this.data);
    return entry;
  }

  getMasterList() {
    return this.data.activeShop ? this.data.activeShop.masterList : [];
  }

  getClaimedSlotTitles() {
    const list = this.getMasterList();
    return list.map(entry => entry.slotGame);
  }

  // Autocomplete Stake Slot Search helper
  searchAvailableSlots(query = '') {
    const claimedTitles = this.getClaimedSlotTitles();
    return searchSlots(query, claimedTitles, 25);
  }
}

module.exports = new TicketShopManager();
