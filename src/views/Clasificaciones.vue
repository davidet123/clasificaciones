<template>
  <v-row>
    <v-col class="text-center">
      Clasificaciones
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="6" class="px-4">
      <v-select
        v-model="categoria"
        density="compact"
        :items="categoriasAMostrar"
  
      ></v-select>
  
    </v-col>
    <v-col cols="6" class="text-center">
      <v-btn-toggle
        v-model="splitSeleccionado"
        color="primary"
        group
        divided
      >
      
      <v-btn size="x-small" width="100px" v-for="split in splitsToShow" :value="split" :key="split" >{{ split }}</v-btn>
    </v-btn-toggle>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="10" offset="1">
      <v-table>
        <thead>
          <tr>
            <th>Dorsal</th>
            <th>Nombre</th>
            <th>Equipo</th>
            <th>Tiempo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="corredor in listadoFiltrado" :key="corredor.dorsal">
            <td>{{ corredor.dorsal }}</td>
            <td>{{ corredor.nombre }}</td>
            <td>{{ corredor.equipo }}</td>
            <td>{{ corredor.tiempos[splitSeleccionado] }}</td>
  
  
          </tr>
        </tbody>
      </v-table>
    </v-col>
  </v-row>
  <v-row>
    <v-col class="text-center">
      <v-btn @click="enviarClasificacion" color="success" size="small">ENVIAR CLASIFICACIÓN</v-btn>
    </v-col>
    <v-col class="text-center">
      <v-btn @click="enviarTop5" color="success" size="small">ENVIAR TOP 5</v-btn>
    </v-col>
    <v-col>
      <v-btn @click="router.push('/control')" color="error" size="small">VOLVER</v-btn>
    </v-col>
  </v-row>

    
</template>

<script setup>
import { useRunnersStore } from '@/stores/runnersStore'
import { usevMixStore } from '@/stores/vMix'
import { storeToRefs } from 'pinia'   
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const runnersStore = useRunnersStore()
const vmixStore = usevMixStore()


const { clasificaciones, categorias, splits } = storeToRefs(runnersStore)   

const splitsToShow = ref([...splits.value, 'Meta'])
const categoriasAMostrar = computed(() => [...categorias.value, 'GENERAL MASCULINA', 'GENERAL FEMENINA'])

const categoria = ref('') 
const splitSeleccionado = ref('7k')

const listadoFiltrado = computed(() => {
  if (!categoria.value) {
    return null
  }
  if(categoria.value === 'GENERAL MASCULINA') {
    const corredoresHombres = clasificaciones.value.filter(corredor => corredor.sexo === '1')
    corredoresHombres.sort((a, b) => {
      const tiempoA = a.tiempos[splitSeleccionado.value] || '99:99:99'
      const tiempoB = b.tiempos[splitSeleccionado.value] || '99:99:99'
      return tiempoA.localeCompare(tiempoB)
    })
    return corredoresHombres.splice(0, 10)
  } else if(categoria.value === 'GENERAL FEMENINA') {
    const corredoresMujeres = clasificaciones.value.filter(corredor => corredor.sexo === '2')
    corredoresMujeres.sort((a, b) => {
      const tiempoA = a.tiempos[splitSeleccionado.value] || '99:99:99'
      const tiempoB = b.tiempos[splitSeleccionado.value] || '99:99:99'
      return tiempoA.localeCompare(tiempoB)
    })
    return corredoresMujeres.splice(0, 10)
  } else {

    const corredoresEnCategoria = clasificaciones.value.filter(corredor => corredor.categoria === categoria.value)
    corredoresEnCategoria.sort((a, b) => {
      const tiempoA = a.tiempos[splitSeleccionado.value] || '99:99:99'
      const tiempoB = b.tiempos[splitSeleccionado.value] || '99:99:99'
      return tiempoA.localeCompare(tiempoB)
    })
    return corredoresEnCategoria.splice(0, 10)
  }
})

const enviarClasificacion = () => {
  if (!categoria.value) {
    alert('Selecciona una categoría')
    return
  }
  if (!splitSeleccionado.value) {
    alert('Selecciona un split')
    return
  }
  const listado = listadoFiltrado.value
  if (!listado || listado.length === 0) {
    alert('No hay corredores en la categoría seleccionada')
    return
  }

  // listado, nombreClasificacion, input, split,  filas
  const nombreClasificacion = `${categoria.value} - ${splitSeleccionado.value}`
  const input = 'CLASIFICACION'
  vmixStore.envioClasificacionesvMix(listadoFiltrado.value, nombreClasificacion, input, splitSeleccionado.value, listadoFiltrado.value.length)
}
const enviarTop5 = () => {
  if (!categoria.value) {
    alert('Selecciona una categoría')
    return
  }
  if (!splitSeleccionado.value) {
    alert('Selecciona un split')
    return
  }
  const listado = listadoFiltrado.value
  if (!listado || listado.length === 0) {
    alert('No hay corredores en la categoría seleccionada')
    return
  }

  // listado, nombreClasificacion, input, split,  filas
  const nombreClasificacion = `${categoria.value} - ${splitSeleccionado.value}`
  const input = 'TOP_5'
  vmixStore.envioClasificacionesvMix(listadoFiltrado.value, nombreClasificacion, input, splitSeleccionado.value, 5)
}


</script>

<style scoped>

</style>