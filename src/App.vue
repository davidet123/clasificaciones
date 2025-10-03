
<template>
  <v-app>
    <v-main>

      <RouterView />
    </v-main>
  </v-app>
  
</template>


<script setup>
  import { RouterLink, RouterView } from 'vue-router'
  import { useGetDatastore } from './stores/getData'
  import { usevMixStore } from './stores/vMix'
  import { onBeforeMount } from 'vue'

  const getDataStore = useGetDatastore()
  const vMixStore = usevMixStore()

  onBeforeMount(() => {
    // const url = 'https://www.alcanzatumeta.es/resultados-medallas.php?e=832006'
    // const url = 'https://www.alcanzatumeta.es/resultados-medallas/832006.csv'
    const url = 'https://www.alcanzatumeta.es/resultados-medallas.php?e=1002805'
    // getDataStore.cargarDesdeURL()
    // getDataStore.cargarCSV()
    // vMixStore.getStatusVmix()
  })

</script>

<style>
body {
  padding: 20px;
  background-color: #9b9b9b;
}

</style>
