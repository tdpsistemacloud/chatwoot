require 'rails_helper'

RSpec.describe ContactInbox do
  describe '#reuse_or_create_whatsapp_conversation' do
    let(:contact_inbox) { create(:contact_inbox) }

    it 'prefers an open conversation over a more recent pending conversation' do
      open_conversation = create(:conversation, contact_inbox: contact_inbox, status: :open, last_activity_at: 1.day.ago)
      create(:conversation, contact_inbox: contact_inbox, status: :pending)

      expect(contact_inbox.reuse_or_create_whatsapp_conversation { raise 'unexpected creation' }).to eq(open_conversation)
    end

    it 'reuses pending and snoozed conversations' do
      conversation = create(:conversation, contact_inbox: contact_inbox, status: :pending)
      expect(contact_inbox.reuse_or_create_whatsapp_conversation { raise 'unexpected creation' }).to eq(conversation)
      conversation.update!(status: :snoozed)
      expect(contact_inbox.reuse_or_create_whatsapp_conversation { raise 'unexpected creation' }).to eq(conversation)
    end

    it 'creates after resolution without reusing another identity' do
      create(:conversation, contact_inbox: contact_inbox, status: :resolved)
      create(:conversation, status: :open)

      result = contact_inbox.reuse_or_create_whatsapp_conversation do
        create(:conversation, contact_inbox: contact_inbox)
      end

      expect(result).to be_open
      expect(contact_inbox.conversations.count).to eq(2)
    end
  end
end
