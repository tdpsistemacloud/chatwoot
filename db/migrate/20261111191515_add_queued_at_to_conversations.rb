class AddQueuedAtToConversations < ActiveRecord::Migration[7.2]
  def change
    add_column :conversations, :queued_at, :datetime
    add_column :conversations, :queue_notified_position, :integer
  end
end
