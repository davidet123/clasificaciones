<template>
  <v-row>
    <v-col cols="6" class="text-center">
      <p>{{ url }}{{ num_carrera }}</p>

    </v-col>
    <v-col cols="3" offset="1" class="text-center">
      <v-text-field
        label="numCarrera"
        v-model="num_carrera"
      ></v-text-field>

    </v-col>
    <v-col cols="12" class="text-center">
      <v-btn color="primary" size="x-small" @click="getData()">ACTUALIZAR DATOS</v-btn>
    </v-col>
    <v-col cols="6" class="text-center">
      <h4>Última actualizacion </h4><p class="font-weight-bold">{{ ultimaActualizacion }}</p>
    </v-col>
    <v-col class="text-center">
      <h4>Total corredores: </h4><p class="font-weight-bold">{{ datos.length }}</p>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="4">
      <v-text-field
        label="Dorsal"
        v-model="dorsalBuscado"
        density="compact"
      ></v-text-field>
    </v-col>
    <v-col cols="1">
      <v-btn color="error" size="x-small" @click="dorsalBuscado = null">X</v-btn>
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="12">

      <div v-if="datos">
        <div v-if="dorsalBuscado">
  
          <div v-if="corredorBuscado">
            <v-row>
              <v-col cols="10">
                <Corredor :corredor="corredorBuscado" />
              </v-col>
              <v-col cols="2" class="ma-0 pa-0 text-right">
                <v-btn size="x-small" color="success">ENVIAR</v-btn>
              </v-col>
            </v-row>
          </div>
          <div v-else>
            Dorsal no encontrado
          </div>
        </div>
      </div>
    </v-col>
    
  </v-row>
  <v-row>
    <v-col cols="5">
      <v-select
        density="compact"
        label="Clasificaciones generales"
        :items="filtroClasificacion"
        v-model="catClasificacionGeneral"
      ></v-select>
    </v-col>
    <v-col cols="1">
      <v-btn color="error" size="x-small" @click="catClasificacionGeneral = null">X</v-btn>
    </v-col>
    <v-col cols="5">
      <v-select
        density="compact"
        label="Clasificaciones por categorias"
        :items="todasCategorias"
        v-model="catClasificacion"
      ></v-select>

    </v-col>
    <v-col cols="1">
      <v-btn color="error" size="x-small" @click="catClasificacion = null">X</v-btn>
    </v-col>
  </v-row>

  <div v-if="catClasificacionGeneral">
    <v-row>
      <v-col cols="12" class="text-center">
        CLASIFICACION {{ catClasificacionGeneral }}
      </v-col>
    </v-row>
    <v-row v-for="(corredor, index) in clasificacionGeneralFiltrada" :key="corredor.dorsal">
      <v-col cols="12">
        <Corredor :corredor="corredor" />
      </v-col>
      
    </v-row>
    <v-row>
      <v-col class="text-center">
        <v-btn size="x-small" color="success">ENVIAR</v-btn>
      </v-col>
    </v-row>
  </div>
  <div v-if="catClasificacion">
    <v-row>
      <v-col cols="12" class="text-center">
        CLASIFICACION {{ catClasificacion }}
      </v-col>
    </v-row>
    <v-row v-for="(corredor, index) in clasificacionFiltrada" :key="corredor.dorsal">
      <v-col cols="12">
        <Corredor :corredor="corredor" />
      </v-col>
      
    </v-row>
    <v-row>
      <v-col class="text-center">
        <v-btn size="x-small" color="success">ENVIAR</v-btn>
      </v-col>
    </v-row>
  </div>
 
  

</template>

<script setup>
  import { computed, ref, watch } from 'vue'
  import { useGetDatastore } from '@/stores/getData'
  import { storeToRefs } from 'pinia'

  import Corredor from '@/components/Corredor.vue'

  const getDataStore = useGetDatastore()

  const { datos, filtroClasificacion, ultimaActualizacion, todasCategorias, url, num_carrera } = storeToRefs(getDataStore)

  const dorsalBuscado = ref(null)
  const catClasificacion = ref(null)
  const catClasificacionGeneral = ref(null)

  const getData = () => {
    const url = 'https://www.alcanzatumeta.es/resultados-medallas.php?e=832006'
    getDataStore.cargarCSV()
  }

  const corredorBuscado = computed(() => {
    if(!dorsalBuscado) return
    return datos.value.find(el => el.dorsal === dorsalBuscado.value)
  })


  const  tiempoASegundos = tiempo => {
    const partes = tiempo.split(':').map(Number)
    if (partes.length === 2) {
      const [min, seg] = partes
      return min * 60 + seg
    } else if (partes.length === 3) {
      const [hor, min, seg] = partes
      return hor * 3600 + min * 60 + seg
    }
    return Infinity // para valores inesperados
  }

  const clasificacionGeneralFiltrada = computed(() => {
    const sexo = catClasificacionGeneral.value === "GENERAL MASCULINA" ? "H" : "M"  
    return datos.value
      .filter(el => (el.sexo === sexo) && (el.meta !== "-"))
      .sort((a, b) => tiempoASegundos(a.meta) - tiempoASegundos(b.meta))
      .slice(0, 11)
  })
  const clasificacionFiltrada = computed(() => {  
    return datos.value
      .filter(el => (el.categoria === catClasificacion.value) && (el.meta !== "-"))
      .sort((a, b) => tiempoASegundos(a.meta) - tiempoASegundos(b.meta))
      .slice(0, 11)
  })

  watch(() => catClasificacion.value, val => {
    if(val !== null) catClasificacionGeneral.value = null
  })
  watch(() => catClasificacionGeneral.value, val => {
    if(val !== null) catClasificacion.value = null
  })


  // getData()

</script>

<style scoped>

</style>