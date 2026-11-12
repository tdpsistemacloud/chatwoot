class MessageTemplates::Template::QueuePosition
  pattr_initialize [:conversation!, :content!]

  def perform
    conversation.messages.create!(
      account_id: conversation.account_id,
      inbox_id: conversation.inbox_id,
      message_type: :template,
      content: content
    )
  end
end
