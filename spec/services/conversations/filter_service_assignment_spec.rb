require 'rails_helper'

RSpec.describe Conversations::FilterService do
  let(:account) { create(:account) }
  let(:user) { create(:user, account: account, role: :administrator) }
  let(:inbox) { create(:inbox, account: account, enable_auto_assignment: false) }
  let!(:mine) { create(:conversation, account: account, inbox: inbox, assignee: user, status: :open) }
  let!(:unassigned) { create(:conversation, account: account, inbox: inbox, assignee: nil, status: :pending) }
  let(:payload) do
    [
      { attribute_key: 'status', filter_operator: 'equal_to', values: ['open'], query_operator: 'OR' }.with_indifferent_access,
      { attribute_key: 'status', filter_operator: 'equal_to', values: ['pending'], query_operator: nil }.with_indifferent_access
    ]
  end

  it 'intersects the complete OR query with the selected assignment and keeps all counts' do
    result = described_class.new({ payload: payload, assignee_type: 'me' }, user, account).perform

    expect(result[:conversations]).to contain_exactly(mine)
    expect(result[:count]).to include(mine_count: 1, unassigned_count: 1, all_count: 2)
  end

  it 'returns the unassigned part of the original query' do
    result = described_class.new({ payload: payload, assignee_type: 'unassigned' }, user, account).perform

    expect(result[:conversations]).to contain_exactly(unassigned)
    expect(result[:count][:all_count]).to eq(2)
  end

  it 'preserves the original query when assignment is omitted' do
    result = described_class.new({ payload: payload }, user, account).perform

    expect(result[:conversations]).to contain_exactly(mine, unassigned)
  end

  it 'counts bot-assigned conversations without treating them as unassigned or mine' do
    bot = create(:agent_bot)
    create(:conversation, account: account, inbox: inbox, assignee: nil, assignee_agent_bot_id: bot.id)
    result = described_class.new({ payload: payload, assignee_type: 'unassigned' }, user, account).perform

    expect(result[:conversations]).to contain_exactly(unassigned)
    expect(result[:count]).to include(mine_count: 1, unassigned_count: 1, assigned_count: 2, all_count: 3)
  end

  it 'intersects AND filters and the selected assignment' do
    and_payload = [
      { attribute_key: 'status', filter_operator: 'equal_to', values: ['open'], query_operator: 'AND' }.with_indifferent_access,
      { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: [inbox.id], query_operator: nil }.with_indifferent_access
    ]
    result = described_class.new({ payload: and_payload, assignee_type: 'me' }, user, account).perform

    expect(result[:conversations]).to contain_exactly(mine)
    expect(result[:count]).to include(mine_count: 1, unassigned_count: 0, all_count: 1)
  end

  it 'paginates the selected assignment after filtering, with counts across all pages' do
    create_list(:conversation, 26, account: account, inbox: inbox, status: :open, assignee: nil)
    first_page = described_class.new({ payload: payload, assignee_type: 'unassigned', page: 1 }, user, account).perform
    second_page = described_class.new({ payload: payload, assignee_type: 'unassigned', page: 2 }, user, account).perform

    expect(first_page[:count]).to include(unassigned_count: 27, all_count: 28)
    expect(second_page[:count]).to eq(first_page[:count])
    expect(first_page[:conversations].to_a & second_page[:conversations].to_a).to be_empty
    expect(first_page[:conversations].size + second_page[:conversations].size).to eq(27)
  end
end
