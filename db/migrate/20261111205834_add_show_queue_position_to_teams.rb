class AddShowQueuePositionToTeams < ActiveRecord::Migration[7.2]
  def change
    add_column :teams, :show_queue_position, :boolean, default: false, null: false
  end
end
