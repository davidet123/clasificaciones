<template>
  
  <v-row>
    <v-col class="text-center">
      <h4>Control Carreras</h4>
    </v-col>
  </v-row>
  <v-row>
    <v-col class="text-center">
      <v-btn
        @click="router.push('/config')"
        color="error"
        size="x-small"
      >CONFIG</v-btn>
    </v-col>
  </v-row>
  <v-row>
    <v-col class="text-center d-flex justify-center ga-1">
      <v-btn
        @click="router.push('/mapa')"
        color="primary"
      >MAPA</v-btn>
      <v-btn
        @click="router.push('/control')"
        color="primary"
      >CONTROL</v-btn>
    </v-col>
  </v-row>
  <v-row>
    <v-col class="text-center">
      <v-btn
        @click="router.push('/alcanzatumeta')"
        color="success"
      >ALCANZATUMETA</v-btn>
    </v-col>
    <v-col class="text-center">
      <v-btn
        @click="router.push('/copernico')"
        color="success"
      >COPERNICO</v-btn>
    </v-col>
  </v-row>
  

</template>

<script setup>
  import router from '@/router'


</script>

<style scoped>

</style>