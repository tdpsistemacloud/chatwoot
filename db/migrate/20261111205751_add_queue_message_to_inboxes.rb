class AddQueueMessageToInboxes < ActiveRecord::Migration[7.2]
  def change
    add_column :inboxes, :queue_message, :text
  end
end
