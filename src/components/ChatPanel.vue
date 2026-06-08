<script setup>
// Inner chat box shared by gameplay & actions; the positioning wrapper stays in each view.
defineProps({
  messages: { type: Array, default: () => [] },
  show: { type: Boolean, default: false },
})
</script>

<template>
  <div
    class="pt-[10px] h-full w-full border-[3px] border-[#7ba4af] rounded-[7px] bg-black transition-opacity duration-300"
    :class="show ? 'opacity-100' : 'opacity-0 pointer-events-none'"
  >
    <div class="flex h-full flex-col-reverse overflow-hidden text-[16px] p-2 text-white">
      <div v-for="(msg, idx) in messages" :key="`${msg.timestamp}-${idx}`" class="flex gap-2">
        <span class="text-gray-300 font-lexend-regular">{{ msg.timestamp }}</span>
        <span
          class="font-lexend-black"
          :class="msg.team === 'left' ? 'text-red-400' : msg.team === 'right' ? 'text-blue-400' : 'text-gray-400'"
        >
          {{ msg.name }}
        </span>
        <span class="font-tpsans-regular break-words overflow-hidden">{{ msg.message }}</span>
      </div>
    </div>
  </div>
</template>
