<script setup>
import Icon from 'dashboard/components-next/icon/Icon.vue';

defineProps({
  position: { type: Number, required: true },
});
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5 flex-shrink-0 rounded px-1.5 py-0.5 bg-n-amber-3 text-n-amber-11 text-xxs font-medium leading-3 whitespace-nowrap"
  >
    <Icon icon="i-lucide-users-round" class="size-3 flex-shrink-0" />
    {{ $t('CHAT_LIST.QUEUE_POSITION', { position }) }}
  </span>
</template>
