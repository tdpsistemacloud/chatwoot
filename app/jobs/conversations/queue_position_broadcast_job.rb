class Conversations::QueuePositionBroadcastJob < ApplicationJob
  queue_as :high

  EVENT_NAME = 'conversation.queue_position_updated'.freeze

  # Any entry, exit or transfer can shift the others, so every queued conversation of the affected teams gets its current position.
  def perform(conversation, team_ids)
    queued = conversation.account.conversations.open.where(team_id: team_ids).where.not(queued_at: nil).where.not(id: conversation.id)
                         .includes(:team, :contact, :contact_inbox, inbox: :channel)

    [conversation, *queued].each do |queued_conversation|
      payload = Conversations::QueuePositionService.new(conversation: queued_conversation).payload.merge(account_id: queued_conversation.account_id)
      notify_customer(queued_conversation, payload)
      agent_tokens(queued_conversation.inbox).each { |token| broadcast(token, payload.slice(:id, :queue_position, :account_id)) }
    end
  end

  private

  def notify_customer(conversation, payload)
    return broadcast(conversation.contact_inbox.pubsub_token, payload) unless conversation.inbox.whatsapp?

    # rubocop:disable Rails/SkipsModelValidations
    conversation.with_lock do
      next if payload[:queue_position] == conversation.queue_notified_position

      MessageTemplates::Template::QueuePosition.new(conversation: conversation, content: payload[:queue_message]).perform if payload[:queue_position]
      conversation.update_column(:queue_notified_position, payload[:queue_position])
    end
    # rubocop:enable Rails/SkipsModelValidations
  end

  def agent_tokens(inbox)
    @agent_tokens ||= {}
    @agent_tokens[inbox.id] ||= (inbox.members.pluck(:pubsub_token) + inbox.account.administrators.pluck(:pubsub_token)).uniq
  end

  def broadcast(token, data)
    ActionCable.server.broadcast(token, { event: EVENT_NAME, data: data })
  end
end
