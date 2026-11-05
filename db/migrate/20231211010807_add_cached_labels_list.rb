class AddCachedLabelsList < ActiveRecord::Migration[7.0]
  def change
    add_column :conversations, :cached_label_list, :string unless column_exists?(:conversations, :cached_label_list)
    Conversation.reset_column_information
    ActsAsTaggableOn::Taggable::Caching.included(Conversation) if defined?(ActsAsTaggableOn::Taggable::Caching)
  end
end
