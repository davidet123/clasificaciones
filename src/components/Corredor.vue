<template>
  <div v-if="corredor" class="corredor">
    <v-row class="ma-0 pa-0">
      <v-col cols="1" class="px-2 text-center">{{ corredor.dorsal }}</v-col>
      <v-col cols="6" class="px-2">{{ corredor.name }} {{ corredor.nombre }}</v-col>
      <v-col cols="2" class="px-2">{{ vMixStore.convertirMilisegundosAHHMMSS(corredor.tiempos[split]) }}</v-col>
      <v-col cols="3" class="px-2">{{ split }}</v-col>
    </v-row>
    <!-- {{ corredor.tiempos[splitSeleccionado] }} -->

  </div>
</template>

<script setup>
import { usevMixStore } from '@/stores/vMix'
const vMixStore = usevMixStore()

const props = defineProps(["corredor", "split"])


</script>

<style scoped>

  .corredor {
    border: 1px solid black;
    background-color: #525151;
    font-weight: bold;
    color: white;
  }

</style>