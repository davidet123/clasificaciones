<template>
  <div v-if="corredor" class="corredor">
    <v-row class="ma-0 pa-0">
      <v-col cols="2" class="px-2 text-center">{{ corredor.dorsal }}</v-col>
      <v-col cols="8" class="px-2">{{ corredor.nombre }}</v-col>
      <v-col cols="2" class="px-2">{{ corredor.meta }}</v-col>
    </v-row>

  </div>
</template>

<script setup>

const props = defineProps(["corredor"])

</script>

<style scoped>

  .corredor {
    border: 1px solid black;
    background-color: #525151;
    font-weight: bold;
    color: white;
  }

</style>