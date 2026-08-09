const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const ticketShopManager = require('./ticketShopManager');
const { findSimilarGame } = require('./fuzzyMatcher');

const pendingRedemptions = new Map();

/**
 * User Shop View Embed
 */
function buildUserShopEmbed(userId, clientUsername) {
  const activeShop = ticketShopManager.getActiveShop();

  if (!activeShop) {
    const closedEmbed = new EmbedBuilder()
      .setTitle('🎟️ Ticket Shop - Closed')
      .setColor(0xFF4500)
      .setDescription('The ticket shop is currently closed. Please check back later when an admin opens a new event shop!')
      .setFooter({ text: 'Tournament & Ticket Shop Addon' });

    return { embeds: [closedEmbed], components: [] };
  }

  const userBalance = ticketShopManager.getUserBalance(userId, activeShop.ticketTypeId);
  const allowMultiples = activeShop.allowMultiples;

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ Ticket Shop - ${activeShop.eventName}`)
    .setColor(0x00BFFF)
    .setDescription(
      `**Event Description:** ${activeShop.description}\n\n` +
      `• **Ticket Price:** Send tip of **${activeShop.cost}** to bot: **@${clientUsername}**\n` +
      `• **Purchase Rule:** ${allowMultiples ? 'Multiples Allowed' : 'Limited to Max 5 Tickets'}\n` +
      `• **Your Ticket Balance:** **${userBalance}** ticket(s)`
    )
    .addFields(
      {
        name: '🛒 How to Buy Tickets',
        value: `Click **Buy Ticket** below. The bot will give you tip payment instructions to send **${activeShop.cost}** to **@${clientUsername}**.`
      },
      {
        name: '🎰 How to Redeem Tickets',
        value: `Click **Redeem Ticket** or use \`/shop redeem\` to pick a Stake.com slot game for the event!`
      }
    )
    .setFooter({ text: 'Tournament & Ticket Shop Addon' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('user_buy_ticket')
      .setLabel('Buy Ticket (Tip Bot)')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💸'),

    new ButtonBuilder()
      .setCustomId('user_redeem_ticket_confirm')
      .setLabel('Redeem Ticket for Event')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(userBalance < 1)
      .setEmoji('🎁'),

    new ButtonBuilder()
      .setCustomId('user_check_balance')
      .setLabel('My Balance')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💳')
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Creates Tip-to-Bot Purchase Invoice Embed & Buttons
 */
function createTipInvoicePayload(userId, botUsername) {
  const activeShop = ticketShopManager.getActiveShop();
  if (!activeShop) return { content: '❌ The ticket shop is closed.' };

  const invoice = ticketShopManager.createTipInvoice(userId, activeShop.ticketTypeId, botUsername, 1);
  if (invoice.error) {
    return { content: `❌ ${invoice.error}`, ephemeral: true };
  }

  const invoiceEmbed = new EmbedBuilder()
    .setTitle(`💸 Ticket Purchase Invoice - ${invoice.eventName}`)
    .setColor(0xFFD700)
    .setDescription(
      `To complete your ticket purchase for **${invoice.eventName}**, please send a tip of **${invoice.cost}** to the bot's username.\n\n` +
      `**Payment Instructions:**\n` +
      `1. Send Tip Amount: **${invoice.cost}**\n` +
      `2. Tip Recipient Username: **@${botUsername}**\n` +
      `3. Reference Invoice ID: \`${invoice.invoiceId}\`\n\n` +
      `*Once you have sent the tip, click "Confirm Tip Sent" below to credit your ticket to your account balance!*`
    )
    .setFooter({ text: 'Ticket Shop Tipping Verification' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_tip_${invoice.invoiceId}`)
      .setLabel('Confirm Tip Sent')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),

    new ButtonBuilder()
      .setCustomId('user_cancel_invoice')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️')
  );

  return { embeds: [invoiceEmbed], components: [row], ephemeral: true };
}

/**
 * Modal for Slot Call Redemption
 */
function buildRedeemSlotModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_redeem_slot_submit')
    .setTitle('Redeem Ticket - Slot Call');

  const slotInput = new TextInputBuilder()
    .setCustomId('redeem_slot_game')
    .setLabel('Slot Game Name on Stake.com')
    .setPlaceholder('e.g. Sweet Bonanza 1000, Gates of Olympus')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const bonusTypeInput = new TextInputBuilder()
    .setCustomId('redeem_bonus_type')
    .setLabel('Bonus Type (Type "super" or "normal")')
    .setPlaceholder('super or normal')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(slotInput),
    new ActionRowBuilder().addComponents(bonusTypeInput)
  );

  return modal;
}

/**
 * Handles Slot Call Redemption Submission (from Modal or Autocomplete Command)
 */
async function handleRedeemSubmission(interaction, slotGameInput, bonusTypeInput) {
  const activeShop = ticketShopManager.getActiveShop();
  if (!activeShop) {
    return interaction.reply({ content: '❌ The ticket shop is not open.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const username = `@${interaction.user.username}`;
  const userBalance = ticketShopManager.getUserBalance(userId, activeShop.ticketTypeId);

  if (userBalance < 1) {
    return interaction.reply({
      content: '❌ You do not have enough tickets to redeem! Please purchase a ticket first.',
      ephemeral: true
    });
  }

  const normalizedBonus = bonusTypeInput.trim().toLowerCase();
  const bonusType = (normalizedBonus === 'super' || normalizedBonus === 'super bonus') ? 'Super' : 'Normal';

  // 60% Fuzzy Check against active event Master List
  const masterList = ticketShopManager.getMasterList();
  const matchResult = findSimilarGame(slotGameInput, masterList, 0.60);

  if (matchResult.matchFound) {
    const pendingKey = `${userId}_${Date.now()}`;
    pendingRedemptions.set(pendingKey, {
      userId,
      username,
      slotGame: slotGameInput,
      bonusType,
      ticketTypeId: activeShop.ticketTypeId
    });

    const warningEmbed = new EmbedBuilder()
      .setTitle('⚠️ Similar Slot Game Detected!')
      .setColor(0xFFA500)
      .setDescription(
        `A similar slot game is already registered on the master list:\n` +
        `• Existing Claimed Game: **"${matchResult.matchedGame}"** (by ${matchResult.matchedUser})\n` +
        `• Your Entry: **"${slotGameInput}"**\n` +
        `• Similarity Match: **${matchResult.similarity}**\n\n` +
        `**Is your game "${slotGameInput}" the same game as "${matchResult.matchedGame}"?**`
      )
      .setFooter({ text: 'If it is the same game, you will be prompted to pick a different game.' });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fuzzy_same_${pendingKey}`)
        .setLabel('Yes, it is the SAME game')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️'),

      new ButtonBuilder()
        .setCustomId(`fuzzy_different_${pendingKey}`)
        .setLabel('No, it is a DIFFERENT game')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    return interaction.reply({
      embeds: [warningEmbed],
      components: [confirmRow],
      ephemeral: true
    });
  }

  return completeRedemption(interaction, userId, username, slotGameInput, bonusType, activeShop.ticketTypeId);
}

/**
 * Completes Redemption & Credits Entry to Master List
 */
function completeRedemption(interactionOrButton, userId, username, slotGame, bonusType, ticketTypeId) {
  const successDeduct = ticketShopManager.deductTicketFromUser(userId, ticketTypeId, 1);

  if (!successDeduct) {
    const errorMsg = '❌ Failed to redeem ticket. Insufficient ticket balance.';
    return interactionOrButton.isButton() || interactionOrButton.isModalSubmit()
      ? interactionOrButton.reply({ content: errorMsg, ephemeral: true })
      : interactionOrButton.update({ content: errorMsg, embeds: [], components: [] });
  }

  ticketShopManager.addEntryToMasterList(userId, username, slotGame, bonusType);
  const remainingBalance = ticketShopManager.getUserBalance(userId, ticketTypeId);

  const confirmEmbed = new EmbedBuilder()
    .setTitle('🎉 Ticket Redeemed & Slot Call Submitted!')
    .setColor(0x00FF7F)
    .setDescription(
      `Congratulations ${username}! Your slot entry has been registered for the event.\n\n` +
      `• **User:** ${username}\n` +
      `• **Slot Game Picked:** **${slotGame}**\n` +
      `• **Bonus Type:** **${bonusType}**\n` +
      `• **Remaining Tickets:** **${remainingBalance}** ticket(s)`
    )
    .setFooter({ text: 'Tournament & Ticket Shop Addon' })
    .setTimestamp();

  if (interactionOrButton.deferred || interactionOrButton.replied) {
    return interactionOrButton.followUp({ embeds: [confirmEmbed], ephemeral: true });
  } else {
    return interactionOrButton.reply({ embeds: [confirmEmbed], ephemeral: true });
  }
}

module.exports = {
  buildUserShopEmbed,
  createTipInvoicePayload,
  buildRedeemSlotModal,
  handleRedeemSubmission,
  completeRedemption,
  pendingRedemptions
};
