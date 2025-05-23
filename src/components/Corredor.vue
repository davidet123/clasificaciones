<template>
  <div v-if="corredor">
    <v-row>
      <v-col cols="2" class="ma-0 pa-0 px-2 text-center">{{ corredor.dorsal }}</v-col>
      <v-col cols="8" class="ma-0 pa-0 px-2">{{ corredor.nombre }}</v-col>
      <v-col cols="2" class="ma-0 pa-0 px-2">{{ corredor.meta }}</v-col>
    </v-row>

  </div>
</template>

<script setup>

const props = defineProps(["corredor"])

</script>

<style scoped>

</style>