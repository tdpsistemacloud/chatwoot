class Conversations::QueuePositionService
  pattr_initialize [:conversation!]

  def payload
    position = conversation.queue_position

    {
      id: conversation.display_id,
      queue_position: position,
      queue_message: position && rendered_message
    }
  end

  private

  def rendered_message
    Liquid::Template.parse(conversation.inbox.queue_message).render(
      'conversation' => ConversationDrop.new(conversation),
      'contact' => ContactDrop.new(conversation.contact),
      'inbox' => InboxDrop.new(conversation.inbox)
    )
  end
end
