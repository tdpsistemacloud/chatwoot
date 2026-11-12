<script setup>
defineProps({
  message: { type: String, required: true },
});
</script>

<template>
  <div
    class="mb-2.5 rounded-[7px] bg-n-slate-3 px-3 py-2 text-sm text-n-slate-12 whitespace-pre-line"
    role="status"
    aria-live="polite"
  >
    {{ message }}
  </div>
</template>
