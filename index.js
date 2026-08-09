require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const ticketShopManager = require('./ticketShopManager');
const adminPanel = require('./adminPanel');
const userPanel = require('./userPanel');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Slash Command Definitions with Autocomplete Slot Selector
const commands = [
  new SlashCommandBuilder()
    .setName('ticketshop')
    .setDescription('Admin Control Panel for Ticket Shop & Tournaments')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Ticket Shop: View, Buy (Tip Bot), and Redeem Tickets')
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View the current ticket shop, price, and your ticket balance')
    )
    .addSubcommand(sub =>
      sub
        .setName('redeem')
        .setDescription('Redeem a ticket for a Stake.com slot game event')
        .addStringOption(opt =>
          opt
            .setName('slot')
            .setDescription('Select a slot game on Stake.com (autocomplete zero-duplicates)')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt
            .setName('bonus_type')
            .setDescription('Select bonus type (Normal or Super)')
            .setRequired(true)
            .addChoices(
              { name: 'Normal Bonus', value: 'normal' },
              { name: 'Super Bonus', value: 'super' }
            )
        )
    )
].map(cmd => cmd.toJSON());

// Slash Command Registration
async function registerSlashCommands() {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token || !clientId) {
      console.log('⚠️ Environment variables DISCORD_TOKEN or CLIENT_ID missing. Slash command registration skipped.');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    console.log('🔄 Registering slash commands...');

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ Guild Slash Commands registered for Guild ID: ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ Global Slash Commands registered.');
    }
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

client.once('ready', () => {
  console.log(`🚀 Logged in as ${client.user.tag}! Tournament & Ticket Shop Manager is active.`);
  registerSlashCommands();
});

client.on('interactionCreate', async (interaction) => {
  try {
    // -------------------------------------------------------------
    // 1. AUTOCOMPLETE INTERACTION HANDLER (Live Slot Selector)
    // -------------------------------------------------------------
    if (interaction.isAutocomplete()) {
      const focusedOption = interaction.getFocused(true);

      if (focusedOption.name === 'slot') {
        const query = focusedOption.value || '';
        // Search slot database excluding games already claimed for active event
        const matchingSlots = ticketShopManager.searchAvailableSlots(query);

        const choices = matchingSlots.map(slot => ({
          name: `${slot.title} [${slot.provider}]${slot.hasSuperBonus ? ' (Super Available)' : ''}`,
          value: slot.title
        }));

        return interaction.respond(choices);
      }
    }

    // -------------------------------------------------------------
    // 2. SLASH COMMAND HANDLERS
    // -------------------------------------------------------------
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'ticketshop') {
        const panelData = adminPanel.buildAdminPanelEmbed();
        return interaction.reply({ ...panelData, ephemeral: true });
      }

      if (commandName === 'shop') {
        const subcommand = interaction.options.getSubcommand(false) || 'view';

        if (subcommand === 'view') {
          const botUsername = client.user.username;
          const shopData = userPanel.buildUserShopEmbed(interaction.user.id, botUsername);
          return interaction.reply({ ...shopData, ephemeral: true });
        }

        if (subcommand === 'redeem') {
          const slotGame = interaction.options.getString('slot');
          const bonusType = interaction.options.getString('bonus_type');

          return userPanel.handleRedeemSubmission(interaction, slotGame, bonusType);
        }
      }
    }

    // -------------------------------------------------------------
    // 3. BUTTON INTERACTION HANDLERS
    // -------------------------------------------------------------
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const botUsername = client.user.username;

      // --- Admin Panel Buttons ---
      if (customId === 'admin_refresh_panel') {
        const panelData = adminPanel.buildAdminPanelEmbed();
        return interaction.update(panelData);
      }

      if (customId === 'admin_add_ticket_modal') {
        const modal = adminPanel.buildAddTicketModal();
        return interaction.showModal(modal);
      }

      if (customId === 'admin_open_shop_select') {
        const selectRow = adminPanel.buildOpenShopSelectMenu();
        if (!selectRow) {
          return interaction.reply({
            content: '❌ No ticket templates exist. Please click **Add Ticket** to create an event template first.',
            ephemeral: true
          });
        }
        return interaction.reply({
          content: 'Select which event ticket option you would like to open the shop for:',
          components: [selectRow],
          ephemeral: true
        });
      }

      if (customId === 'admin_close_shop') {
        const closedEvent = ticketShopManager.closeShop();
        if (!closedEvent) {
          return interaction.reply({ content: '❌ No shop is currently open.', ephemeral: true });
        }
        const updatedPanel = adminPanel.buildAdminPanelEmbed();
        await interaction.update(updatedPanel);
        return interaction.followUp({
          content: `🔒 **Ticket Shop Closed!** Master list for **"${closedEvent.eventName}"** saved (${closedEvent.masterList.length} entries).`,
          ephemeral: true
        });
      }

      if (customId === 'admin_remove_ticket_select') {
        const selectRow = adminPanel.buildRemoveTicketSelectMenu();
        if (!selectRow) {
          return interaction.reply({ content: '❌ No ticket templates exist to remove.', ephemeral: true });
        }
        return interaction.reply({
          content: 'Select which ticket template to remove:',
          components: [selectRow],
          ephemeral: true
        });
      }

      if (customId === 'admin_view_master_list') {
        const activeShop = ticketShopManager.getActiveShop();
        if (!activeShop || activeShop.masterList.length === 0) {
          return interaction.reply({ content: '📜 Master list is currently empty.', ephemeral: true });
        }

        const entriesText = activeShop.masterList.map((entry, index) =>
          `**${index + 1}.** ${entry.username} — 🎰 **${entry.slotGame}** (${entry.bonusType})`
        ).join('\n');

        const listEmbed = new EmbedBuilder()
          .setTitle(`📜 Master Entry List - ${activeShop.eventName}`)
          .setColor(0x00BFFF)
          .setDescription(entriesText.length > 3900 ? entriesText.substring(0, 3900) + '\n... (truncated)' : entriesText)
          .setFooter({ text: `Total Entries: ${activeShop.masterList.length}` })
          .setTimestamp();

        return interaction.reply({ embeds: [listEmbed], ephemeral: true });
      }

      // --- User Shop Buttons & Tip Payments ---
      if (customId === 'user_check_balance') {
        const activeShop = ticketShopManager.getActiveShop();
        if (!activeShop) {
          return interaction.reply({ content: 'The shop is currently closed.', ephemeral: true });
        }
        const balance = ticketShopManager.getUserBalance(interaction.user.id, activeShop.ticketTypeId);
        return interaction.reply({
          content: `💳 Your current ticket balance for **${activeShop.eventName}** is: **${balance}** ticket(s).`,
          ephemeral: true
        });
      }

      if (customId === 'user_buy_ticket') {
        // Generate Tip-to-Bot purchase invoice payload
        const invoicePayload = userPanel.createTipInvoicePayload(interaction.user.id, botUsername);
        return interaction.reply(invoicePayload);
      }

      if (customId.startsWith('confirm_tip_')) {
        const invoiceId = customId.replace('confirm_tip_', '');
        const confirmResult = ticketShopManager.confirmTipInvoice(invoiceId);

        if (!confirmResult || !confirmResult.success) {
          return interaction.reply({
            content: '❌ Could not verify tip payment or invoice already processed.',
            ephemeral: true
          });
        }

        return interaction.reply({
          content: `🎉 **Tip Payment Verified!** 1 ticket for **${confirmResult.eventName}** has been added to your account! Current balance: **${confirmResult.newBalance}** ticket(s).`,
          ephemeral: true
        });
      }

      if (customId === 'user_cancel_invoice') {
        return interaction.update({ content: '✖️ Ticket purchase invoice cancelled.', embeds: [], components: [] });
      }

      if (customId === 'user_redeem_ticket_confirm') {
        const activeShop = ticketShopManager.getActiveShop();
        if (!activeShop) {
          return interaction.reply({ content: '❌ The ticket shop is closed.', ephemeral: true });
        }

        const balance = ticketShopManager.getUserBalance(interaction.user.id, activeShop.ticketTypeId);
        if (balance < 1) {
          return interaction.reply({
            content: '❌ You do not have enough tickets to redeem! Click **Buy Ticket (Tip Bot)** first.',
            ephemeral: true
          });
        }

        const redeemModal = userPanel.buildRedeemSlotModal();
        return interaction.showModal(redeemModal);
      }

      // --- Fuzzy Match Confirmation Buttons ---
      if (customId.startsWith('fuzzy_same_')) {
        const pendingKey = customId.replace('fuzzy_same_', '');
        userPanel.pendingRedemptions.delete(pendingKey);

        return interaction.update({
          content: '❌ **Entry Rejected:** Since your slot game choice is the same as an existing entry on the list, please pick another slot game on Stake.com and redeem again!',
          embeds: [],
          components: []
        });
      }

      if (customId.startsWith('fuzzy_different_')) {
        const pendingKey = customId.replace('fuzzy_different_', '');
        const pending = userPanel.pendingRedemptions.get(pendingKey);

        if (!pending) {
          return interaction.update({
            content: '❌ Redemption session expired. Please click **Redeem Ticket** again.',
            embeds: [],
            components: []
          });
        }

        userPanel.pendingRedemptions.delete(pendingKey);

        return userPanel.completeRedemption(
          interaction,
          pending.userId,
          pending.username,
          pending.slotGame,
          pending.bonusType,
          pending.ticketTypeId
        );
      }
    }

    // -------------------------------------------------------------
    // 4. SELECT MENU HANDLERS
    // -------------------------------------------------------------
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_open_shop_event') {
        const selectedTicketId = interaction.values[0];
        const opened = ticketShopManager.openShop(selectedTicketId);

        if (!opened) {
          return interaction.reply({ content: '❌ Failed to open shop for selected ticket.', ephemeral: true });
        }

        return interaction.reply({
          content: `🟢 **Ticket Shop Opened for Event:** **"${opened.eventName}"**!\nUsers can now use \`/shop view\` to buy (tip bot) and \`/shop redeem\` to claim slot entries.`,
          ephemeral: false
        });
      }

      if (interaction.customId === 'select_remove_ticket_template') {
        const selectedId = interaction.values[0];
        const removed = ticketShopManager.removeTicketTemplate(selectedId);

        if (removed) {
          return interaction.reply({ content: `🗑️ Removed ticket template ID: \`${selectedId}\`.`, ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Could not find ticket template to remove.', ephemeral: true });
        }
      }
    }

    // -------------------------------------------------------------
    // 5. MODAL SUBMIT HANDLERS
    // -------------------------------------------------------------
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_add_ticket_submit') {
        const eventName = interaction.fields.getTextInputValue('ticket_event_name');
        const costStr = interaction.fields.getTextInputValue('ticket_cost');
        const description = interaction.fields.getTextInputValue('ticket_description');
        const allowMultiplesStr = interaction.fields.getTextInputValue('ticket_allow_multiples');

        const cost = parseFloat(costStr) || 1;
        const allowMultiples = allowMultiplesStr.toLowerCase().startsWith('y');

        const template = ticketShopManager.addTicketTemplate(eventName, cost, description, allowMultiples);

        return interaction.reply({
          content: `✅ Created New Ticket Template: **"${template.name}"** (Cost: ${template.cost}, Multiples: ${template.allowMultiples ? 'Yes' : 'No (Max 5 Limit)'}).`,
          ephemeral: true
        });
      }

      if (interaction.customId === 'modal_redeem_slot_submit') {
        const slotGameInput = interaction.fields.getTextInputValue('redeem_slot_game');
        const bonusTypeInput = interaction.fields.getTextInputValue('redeem_bonus_type');

        return userPanel.handleRedeemSubmission(interaction, slotGameInput, bonusTypeInput);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An unexpected error occurred processing your request.', ephemeral: true }).catch(() => {});
    }
  }
});

if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN);
} else {
  console.log('⚠️ DISCORD_TOKEN environment variable is not defined. Please set up your .env file.');
}
