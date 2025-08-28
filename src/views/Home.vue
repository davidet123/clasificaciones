<template>
  
  <v-row>
    <v-col class="text-center">
      <h4>Control Carreras</h4>
    </v-col>
  </v-row>
  <v-row>
    <v-col>
      <v-btn
        @click="router.push('/alcanzatumeta')"
      >ALCANZATUMETA</v-btn>
    </v-col>
    <v-col>
      <v-btn
        @click="router.push('/copernico')"
      >COPERNICO</v-btn>
    </v-col>
  </v-row>
  

</template>

<script setup>
  import router from '@/router'


</script>

<style scoped>

</style>