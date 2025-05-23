<template>
  <div>
    <v-btn color="primary" size="x-small" @click="goLive">PREVIO</v-btn>

  </div>
</template>

<script setup>

  import { computed, ref, watch } from 'vue'
  

  const emit = defineEmits(['goPreviovMix'])

  const props = defineProps(['nombre'])

  const goLive = () => {
    emit('goPreviovMix', props.nombre)
  }

</script>

<style>

</style>
