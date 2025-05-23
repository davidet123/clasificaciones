<template>
  <div>
    <v-btn :color="live ? 'success': 'error'" size="x-small" @click="goLive">LIVE</v-btn>

  </div>
</template>

<script setup>

  import { computed, ref, watch } from 'vue'

  const live = ref(true)

  const emit = defineEmits(['goLivevMix'])

  const props = defineProps(['nombre'])

  const goLive = () => {
    const data = {
      nombre: props.nombre,
      live: live.value
    }
    emit('goLivevMix', data)
    live.value = !live.value

  }

</script>

<style>

</style>
