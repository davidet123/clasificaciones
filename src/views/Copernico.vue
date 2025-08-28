<template>
  <div>
    copernico
  </div>
  <v-row>
    <GenericosVmix />
  </v-row>
  <v-row>
    <v-col class="text-center">
      <v-btn color="error" size="small" @click="getDataStore.getDataCopernico()">ACTUALIZAR DATOS</v-btn>
    </v-col>
  </v-row>
  <v-row>
    <v-col class="text-center">
      <v-btn-toggle
        v-model="splitSeleccionado"
        color="primary"
        group
        divided
      >
      
      <v-btn size="x-small" width="100px" v-for="split in splits" :value="split" :key="split" >{{ split }}</v-btn>
    </v-btn-toggle>
    </v-col>
  </v-row>
  {{ splitSeleccionado }}
  <v-row>
    <v-col cols="6">
      <div v-for="corredor in listadoMasculino" :key="corredor.id">
        <Corredor :corredor="corredor" :split="splitSeleccionado" />
        <!-- {{ corredor }} -->
      </div>
      <v-btn color="success" size="x-small"
        @click="enviarClasificacion(splitSeleccionado, listadoMasculino)"
      >ENVIAR CLASIFICACION</v-btn>

    </v-col>
    <v-col cols="6">
      <div v-for="corredor in listadoFemenino" :key="corredor.id">
        <Corredor :corredor="corredor" :split="splitSeleccionado"/>
        <!-- {{ corredor }} -->
      </div>
      <v-btn color="success" size="x-small"
        @click="enviarClasificacion(splitSeleccionado, listadoFemenino)"
      >ENVIAR CLASIFICACION</v-btn>

    </v-col>

  </v-row>
</template>

<script setup>
import { useGetDatastore } from '@/stores/getData'
import { storeToRefs } from 'pinia'
import { usevMixStore } from '@/stores/vMix'
import GenericosVmix from '@/components/GenericosVmix.vue'

import Corredor from '@/components/Corredor.vue'
import { computed, ref } from 'vue'

const getDataStore = useGetDatastore()
const vMixStore = usevMixStore()

const { testDatos, datos, splits } = storeToRefs(getDataStore)

const splitSeleccionado = ref("Meta")


const listadoMasculino = computed(() => datos.value.filter(el => el.categoria === 'male' && el.tiempos[splitSeleccionado.value]))
const listadoFemenino = computed(() => datos.value.filter(el => el.categoria === 'female'&& el.tiempos[splitSeleccionado.value]))


const enviarClasificacion = async (tipo, listado) => {

  // const listado = tipo === 'general' ? clasificacionGeneralFiltrada.value : clasificacionFiltrada.value
  // const nombreClasificacion = tipo === 'general' ? catClasificacionGeneral.value : catClasificacion.value 
  const nombreClasificacion = tipo === 'male' ? 'Masculina' : "Femenina"
  let input = "CLASIFICACION"
  let maxFilas = 11
  await vMixStore.envioClasificacionesvMix(listado, tipo, input, splitSeleccionado.value, maxFilas)
  
  input = "TOP_5"
  maxFilas = 5
  await vMixStore.envioClasificacionesvMix(listado, tipo, input, splitSeleccionado.value, maxFilas)
  vMixStore.getStatusVmix()
}
// getDataStore.getDataCopernico()

</script>

<style scoped>

</style>