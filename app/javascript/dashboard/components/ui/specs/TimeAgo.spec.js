import { mount } from '@vue/test-utils';
import TimeAgo from '../TimeAgo.vue';

vi.mock('shared/composables/useExactTimestamp', () => ({
  useExactTimestamp: () => timestamp => `date:${timestamp}`,
}));

describe('TimeAgo', () => {
  afterEach(() => vi.useRealTimers());

  const mountClock = props =>
    mount(TimeAgo, {
      props,
      global: {
        mocks: { $t: key => key },
      },
    });

  it('hides creation only when requested and keeps both tooltip dates', () => {
    const wrapper = mountClock({
      createdAtTimestamp: 1700000000,
      lastActivityTimestamp: 1701296000,
      showCreatedAt: false,
      isAutoRefreshEnabled: false,
    });
    expect(wrapper.text().replace(/\s+/g, ' ')).toBe(
      wrapper.vm.lastActivityTime.replace(/\s+/g, ' ').trim()
    );
    expect(wrapper.vm.tooltipText).toContain(wrapper.vm.createdAt);
    expect(wrapper.vm.tooltipText).toContain(wrapper.vm.lastActivity);
    wrapper.unmount();
  });

  it('reschedules an old clock when recent activity arrives', async () => {
    vi.useFakeTimers();
    const now = Date.now() / 1000;
    const wrapper = mountClock({ lastActivityTimestamp: now - 15 * 86400 });
    expect(wrapper.vm.refreshTime()).toBe(86400000);
    await wrapper.setProps({ lastActivityTimestamp: now });
    expect(wrapper.vm.refreshTime()).toBe(60000);
    expect(vi.getTimerCount()).toBe(1);
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
