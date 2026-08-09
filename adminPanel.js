const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const ticketShopManager = require('./ticketShopManager');

/**
 * Builds the main Admin Control Panel Embed and Action Rows
 */
function buildAdminPanelEmbed() {
  const activeShop = ticketShopManager.getActiveShop();
  const templates = ticketShopManager.getTicketTemplates();

  const embed = new EmbedBuilder()
    .setTitle('🎟️ Admin Control Panel - Ticket & Tournament Manager')
    .setColor(activeShop ? 0x00FF7F : 0xFF4500)
    .setDescription(
      `Welcome to the Admin Control Panel.\n\n` +
      `**Current Shop Status:** ${activeShop ? '🟢 OPEN' : '🔴 CLOSED'}\n` +
      (activeShop
        ? `**Active Event:** ${activeShop.eventName}\n` +
          `**Cost:** ${activeShop.cost} tickets\n` +
          `**Allow Multiples:** ${activeShop.allowMultiples ? 'Yes' : 'No (Max 5 Limit)'}\n` +
          `**Total Registered:** ${activeShop.masterList.length} entries`
        : `*No active event currently running.*`)
    )
    .addFields(
      {
        name: '📋 Ticket Templates Registered',
        value: templates.length > 0
          ? templates.map(t => `• **${t.name}** - ${t.cost} tickets (${t.allowMultiples ? 'Multiples Allowed' : 'Max 5 Limit'})`).join('\n')
          : '*No tickets created yet. Click "Add Ticket" to create one.*'
      }
    )
    .setFooter({ text: 'Tournament & Ticket Shop Addon • Admin Mode' })
    .setTimestamp();

  // Action Row 1: Primary Controls
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_open_shop_select')
      .setLabel(activeShop ? 'Switch Event Shop' : 'Open Ticket Shop')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔓'),

    new ButtonBuilder()
      .setCustomId('admin_close_shop')
      .setLabel('Close Ticket Shop')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!activeShop)
      .setEmoji('🔒'),

    new ButtonBuilder()
      .setCustomId('admin_add_ticket_modal')
      .setLabel('Add Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('➕'),

    new ButtonBuilder()
      .setCustomId('admin_remove_ticket_select')
      .setLabel('Remove Ticket')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(templates.length === 0)
      .setEmoji('🗑️')
  );

  // Action Row 2: View Master List / User View Preview
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_view_master_list')
      .setLabel('View Event Master List')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!activeShop || activeShop.masterList.length === 0)
      .setEmoji('📜'),

    new ButtonBuilder()
      .setCustomId('admin_refresh_panel')
      .setLabel('Refresh Panel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * Modal Builder for "Add Ticket"
 */
function buildAddTicketModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_add_ticket_submit')
    .setTitle('Add New Ticket Template');

  const eventNameInput = new TextInputBuilder()
    .setCustomId('ticket_event_name')
    .setLabel('Event Name')
    .setPlaceholder('e.g. Bonus Hunt - Slot Call')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const costInput = new TextInputBuilder()
    .setCustomId('ticket_cost')
    .setLabel('Ticket Cost (Points/Price)')
    .setPlaceholder('e.g. 1')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('ticket_description')
    .setLabel('Brief Description')
    .setPlaceholder('Redeem this ticket to pick a slot for the bonus hunt!')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const multiplesInput = new TextInputBuilder()
    .setCustomId('ticket_allow_multiples')
    .setLabel('Allow Multiples? (Type "yes" or "no")')
    .setPlaceholder('yes = unlimited, no = limit 5 tickets max')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(eventNameInput),
    new ActionRowBuilder().addComponents(costInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(multiplesInput)
  );

  return modal;
}

/**
 * Dropdown Menu for selecting event to open shop for
 */
function buildOpenShopSelectMenu() {
  const templates = ticketShopManager.getTicketTemplates();

  if (templates.length === 0) {
    return null;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_open_shop_event')
    .setPlaceholder('Select Event Type to Open Shop For...');

  templates.forEach(t => {
    selectMenu.addOptions({
      label: t.name,
      value: t.id,
      description: `Cost: ${t.cost} ticket(s) | ${t.allowMultiples ? 'Multiples' : 'Max 5 Limit'}`,
      emoji: '🎫'
    });
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return row;
}

/**
 * Dropdown Menu for selecting ticket template to remove
 */
function buildRemoveTicketSelectMenu() {
  const templates = ticketShopManager.getTicketTemplates();

  if (templates.length === 0) {
    return null;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_remove_ticket_template')
    .setPlaceholder('Select Ticket Template to Remove...');

  templates.forEach(t => {
    selectMenu.addOptions({
      label: t.name,
      value: t.id,
      description: `Cost: ${t.cost} | ID: ${t.id}`,
      emoji: '🗑️'
    });
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return row;
}

module.exports = {
  buildAdminPanelEmbed,
  buildAddTicketModal,
  buildOpenShopSelectMenu,
  buildRemoveTicketSelectMenu
};
