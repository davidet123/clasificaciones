
<template>
  
  <RouterView />
</template>


<script setup>
  import { RouterLink, RouterView } from 'vue-router'
  import { useGetDatastore } from './stores/getData'
  import { onBeforeMount } from 'vue'

  const getDataStore = useGetDatastore()

  onBeforeMount(() => {
    const url = 'https://www.alcanzatumeta.es/resultados-medallas.php?e=832006'
    // const url = 'https://www.alcanzatumeta.es/resultados-medallas.php?e=1002805'
    getDataStore.cargarCSV()
  })

</script>

<style>
/* body {
  padding: 20px;
} */

</style>
