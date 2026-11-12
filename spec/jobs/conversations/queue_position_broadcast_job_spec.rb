require 'rails_helper'

RSpec.describe Conversations::QueuePositionBroadcastJob do
  let(:account) { create(:account) }
  let(:team) { create(:team, account: account, show_queue_position: true) }
  let(:inbox) { create(:channel_whatsapp, account: account, sync_templates: false, validate_provider_config: false).inbox }
  let(:contact) { create(:contact, account: account) }
  let(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: inbox, source_id: '5511999990001') }
  let(:conversation) { create(:conversation, account: account, inbox: inbox, contact: contact, contact_inbox: contact_inbox) }

  before do
    inbox.update!(queue_message: 'Você é o {{ conversation.queue_position }}º da fila')
    conversation.update!(team: team)
  end

  it 'sends the WhatsApp queue message once per position change' do
    expect do
      2.times { described_class.perform_now(conversation, [team.id]) }
    end.to change { conversation.messages.where(message_type: :template).count }.by(1)

    expect(conversation.messages.where(message_type: :template).last.content).to eq('Você é o 1º da fila')
    expect(conversation.reload.queue_notified_position).to eq(1)
  end

  it 'clears the notified position without messaging when the customer leaves the queue' do
    described_class.perform_now(conversation, [team.id])
    conversation.update!(queued_at: nil)

    expect do
      described_class.perform_now(conversation, [team.id])
    end.not_to(change { conversation.messages.count })

    expect(conversation.reload.queue_notified_position).to be_nil
  end
end
