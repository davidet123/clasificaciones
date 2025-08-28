<template>
  <v-row>
    <v-col class="text-center" cols="12">
      <h4>CONTROL CARRERA ALCANZA TU META</h4>
    </v-col>
    <v-col cols="6" class="text-center">
      <p>{{ url }}{{ num_carrera }}</p>

    </v-col>
    <v-col cols="3" offset="1" class="text-center">
      <v-text-field
        label="numCarrera"
        v-model="num_carrera"
      ></v-text-field>

    </v-col>
  </v-row>
  <GenericosVmix />
  <!-- <v-row class="my-2">
    <v-col cols="2">
      <v-select
        v-model="textoDSK"
        :items = "listadoDSK"
        label="DSK genérico"
      ></v-select>
    </v-col>
    <v-col cols="1">
      <BotonLive @goLivevMix="goLive" :nombre="'DSK_GENERICO'"/>
      <BotonPrevio @goPreviovMix="goPrevio" :nombre="'DSK_GENERICO'"/>
    </v-col>
    <v-col cols="2">
      <v-select
      v-model="textoPuntoKM"
      :items = "puntosKM"
      label="PUNTO_KILOMETRICO"
      ></v-select>
    </v-col>
    <v-col cols="1">
      <BotonLive @goLivevMix="goLive" :nombre="'PUNTO_KILOMETRICO'"/>
      <BotonPrevio @goPreviovMix="goPrevio" :nombre="'PUNTO_KILOMETRICO'"/>
      
    </v-col>
    <v-col cols="3" class="border-md">
      <v-row>

        <v-col cols="6" class="text-center">
          <h5>CRONO</h5>
        </v-col>
        <v-col cols="6" class="text-center">
          <BotonLive @goLivevMix="goLive" :nombre="'CRONO'"/>
          <BotonPrevio @goPreviovMix="goPrevio" :nombre="'CRONO'"/>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="2" class="text-center">
          <v-btn color="success" size="x-small" @click="crono('start')">START</v-btn>
        </v-col>
        <v-col cols="2" class="text-center">
          <v-btn color="primary" size="x-small" @click="crono('pause')">PAUSA</v-btn>
        </v-col>
        <v-col cols="2" class="text-center">
          <v-btn color="error" size="x-small" @click="crono('stop')">STOP</v-btn>
        </v-col>
      </v-row>

    </v-col>
    <v-col cols="3" class="text-center border-sm">
      <h4>DOBLE VENTANA</h4>
      <BotonLive @goLivevMix="goLive" :nombre="'DOBLE VENTANA'"/>
      <BotonPrevio @goPreviovMix="goPrevio" :nombre="'DOBLE VENTANA'"/>

    </v-col>
    
  </v-row> -->
  <!-- <v-row class="ma-0 pa-0">
        <v-col cols="3">
          <v-text-field
            v-model="tiempo.cielo"
            label="CIELO"
            density="compact"
          ></v-text-field>
        </v-col>
        <v-col cols="3">
          <v-text-field
            v-model="tiempo.viento"
            label="VIENTO"
            density="compact"
          ></v-text-field>
        </v-col>
        <v-col cols="3">
          <v-text-field
            v-model="tiempo.temperatura"
            label="TEMPERATURA"
            density="compact"
          ></v-text-field>
    </v-col>
    <v-col cols="1">
      <BotonLive @goLivevMix="goLive" :nombre="'METEO'"/>
      <BotonPrevio @goPreviovMix="goPrevio" :nombre="'METEO'"/>
    </v-col>
  </v-row> -->
  <v-row>
    <v-col cols="12" class="text-center">
      <v-btn color="primary" size="x-small" @click="getData()">ACTUALIZAR DATOS</v-btn>
    </v-col>
    <v-col cols="6" class="text-center">
      <h4>Última actualizacion </h4><p class="font-weight-bold">{{ ultimaActualizacion }}</p>
    </v-col>
    <v-col class="text-center">
      <h4>Total corredores: </h4><p class="font-weight-bold">{{ listaFiltradaPorPrueba.length }}</p>
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
    <v-col cols="3" offset="1">
      <v-select
        label="Prueba"
        :items="pruebas"
        v-model="pruebaFiltrada"
      ></v-select>

    </v-col>
  </v-row>
  <v-row>
    <v-col cols="12">
      <div v-if="listaFiltradaPorPrueba">
        <div v-if="dorsalBuscado !== null">
          <div v-if="corredorBuscado">
            <v-row>
              <v-col cols="8">
                <Corredor :corredor="corredorBuscado" />
              </v-col>
              <v-col cols="2" class="ma-0 pa-0 text-center">
                <v-row>
                  <v-col class="text-center">
                    <h6>DSK CORREDOR</h6>

                    <BotonLive @goLivevMix="goLive" :nombre="'DSK_CORREDOR'"/>
                    <BotonPrevio @goPreviovMix="goPrevio" :nombre="'DSK_CORREDOR'"/>
                  </v-col>

                </v-row>
              </v-col>
              <v-col cols="2" class="ma-0 pa-0 text-center">
                
                <v-row>
                  <v-col class="text-center">
                    <h6>CORREEDOR PHOTOCALL</h6>
                    <BotonLive @goLivevMix="goLive" :nombre="'DSK_CORREDOR_PC'"/>
                    <BotonPrevio @goPreviovMix="goPrevio" :nombre="'DSK_CORREDOR_PC'"/>
                  </v-col>
                </v-row>
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
        CLASIFICACION {{ catClasificacionGeneral }} {{ pruebaFiltrada }}
      </v-col>
    </v-row>
    <v-row v-for="(corredor, index) in clasificacionGeneralFiltrada" :key="corredor.dorsal">
      <v-col cols="12">
        <Corredor :corredor="corredor" />
      </v-col>
      
    </v-row>
    <v-row>
      <v-col class="text-center">
        <v-btn size="x-small" color="success" @click="enviarClasificacion('general')">ENVIAR</v-btn>
        </v-col>
      <v-col class="text-center">
         <BotonLive @goLivevMix="goLive" :nombre="'CLASIFICACION'"/>
        <BotonPrevio @goPreviovMix="goPrevio" :nombre="'CLASIFICACION'"/>
      </v-col>
    </v-row>
  </div>
  <div v-if="catClasificacion">
    <v-row>
      <v-col cols="12" class="text-center">
        CLASIFICACION {{ catClasificacion }} {{ pruebaFiltrada }}
      </v-col>
    </v-row>
    <v-row v-for="(corredor, index) in clasificacionFiltrada" :key="corredor.dorsal">
      <v-col cols="12">
        <Corredor :corredor="corredor" />
      </v-col>
      
    </v-row>
    <v-row>
      <v-col class="text-center">
        <v-btn size="x-small" color="success" @click="enviarClasificacion('categoria')">ENVIAR</v-btn>
      </v-col>
      <v-col class="text-center">
        <BotonLive @goLivevMix="goLive" :nombre="'CLASIFICACION'"/>
        <BotonPrevio @goPreviovMix="goPrevio" :nombre="'CLASIFICACION'"/>
        
      </v-col>
    </v-row>
  </div>
 
  

</template>

<script setup>
  import { computed, ref, watch } from 'vue'
  import { useGetDatastore } from '@/stores/getData'
  import { usevMixStore } from '@/stores/vMix'
  import { storeToRefs } from 'pinia'
  import { useNombreUtils } from '@/composables/useNombreUtils'
  import Corredor from '@/components/Corredor.vue'

  import GenericosVmix from '@/components/GenericosVmix.vue'

  import BotonLive from '@/components/BotonLive.vue'
  import BotonPrevio from '@/components/BotonPrevio.vue'

  const { quitarUltimoApellido } = useNombreUtils()
  const getDataStore = useGetDatastore()

  const vMixStore = usevMixStore()

  const { datos, filtroClasificacion, ultimaActualizacion, todasCategorias, url, num_carrera, inscritos, pruebaFiltrada, pruebas } = storeToRefs(getDataStore)

  // const { listadoDSK, puntosKM, tiempo } = storeToRefs(vMixStore)

  const dorsalBuscado = ref(null)
  const catClasificacion = ref(null)
  const catClasificacionGeneral = ref(null)

  // const textoDSK = ref(null)
  // const textoPuntoKM = ref(null)

  const listaFiltradaPorPrueba = computed(() => datos.value.filter(el => el.prueba === pruebaFiltrada.value))
  

  const getData = () => {
    const url = 'https://www.alcanzatumeta.es/resultados-medallas.php?e=832006'
    getDataStore.cargarCSV()
  }

  const corredorBuscado = computed(() => {
    if(!dorsalBuscado || !inscritos.value) return
    // return listaFiltradaPorPrueba.value.find(el => el.dorsal === dorsalBuscado.value)
    return inscritos.value.find(el => el.dorsal === dorsalBuscado.value)
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
    return listaFiltradaPorPrueba.value
      .filter(el => (el.sexo === sexo) && (el.meta !== "-"))
      .sort((a, b) => tiempoASegundos(a.meta) - tiempoASegundos(b.meta))
      .slice(0, 11)
  })
  const clasificacionFiltrada = computed(() => {  
    return listaFiltradaPorPrueba.value
      .filter(el => (el.categoria === catClasificacion.value) && (el.meta !== "-"))
      .sort((a, b) => tiempoASegundos(a.meta) - tiempoASegundos(b.meta))
      .slice(0, 11)
  })

   const enviarClasificacion = (tipo) => {

    const listado = tipo === 'general' ? clasificacionGeneralFiltrada.value : clasificacionFiltrada.value
    const nombreClasificacion = tipo === 'general' ? catClasificacionGeneral.value : catClasificacion.value 
    let input = "CLASIFICACION"

    envioClasificacionesvMix(listado, nombreClasificacion, input, 11)

    input = "TOP_5"
    envioClasificacionesvMix(listado, nombreClasificacion, input, 5)
    

  }

  const envioClasificacionesvMix = async (listado, nombreClasificacion, input, filas) => {

    vMixStore.liveUpdate(input, "CLAS_CATEGORIA", "CLASIFICACION " + nombreClasificacion + " " + pruebaFiltrada.value)

    for(let i = 1; i <= filas ; i++) {      
      // LIMPIAR CLASIFICACIONES
      vMixStore.liveUpdate(input, `NUM_CLAS${i}`, "")
      vMixStore.liveUpdate(input, `NOMBRE_CLAS${i}`, "")
      vMixStore.liveUpdate(input, `TIEMPO_CLAS${i}`, "")
    }
    let orden = 1
    for(let i = 0; i < filas; i++) {      
      // LIMPIAR CLASIFICACIONES
      let nombre = listado[i].nombre
      if(filas == 5) nombre = quitarUltimoApellido(listado[i].nombre)

      console.log(orden)
      vMixStore.liveUpdate(input, `NUM_CLAS${orden}`, orden)
      await vMixStore.wait(50)
      vMixStore.liveUpdate(input, `NOMBRE_CLAS${orden}`, nombre)
      await vMixStore.wait(50)
      vMixStore.liveUpdate(input, `TIEMPO_CLAS${orden}`, listado[i].meta)
      await vMixStore.wait(50)
      orden ++
    }

  }

  const goLive = data => {
    // console.log(data)

    let nombre, capa, val

    // if(data.nombre = 'DSK_GENERICO') {
    //   nombre = data.nombre
    //   capa = 'GENERICO'
    //   val = textoDSK.value
    //   vMixStore.liveUpdate(nombre, capa, val)
    // }
    // if(data.nombre = 'PUNTO_KILOMETRICO') {
    //   nombre = data.nombre
    //   capa = 'GENERICO'
    //   val = textoPuntoKM.value
    //   vMixStore.liveUpdate(nombre, capa, val)
    // }
    // // if(data.nombre = 'DSK_CORREDOR') {
    // //   nombre = data.nombre
    // //   capa = 'GENERICO'
    // //   val = corredorBuscado.value.nombre
    // //   vMixStore.liveUpdate(nombre, capa, val)
    // // }
    // if(data.nombre = 'METEO') {
    //   nombre = data.nombre
    //   val = tiempo.value
    //   capa = 'CIELO_TXT'
    //   vMixStore.liveUpdate(nombre, capa, val.cielo)
    //   capa = 'VIENTO_TXT'
    //   vMixStore.liveUpdate(nombre, capa, val.viento)
    //   capa = 'TEMP_TXT'
    //   vMixStore.liveUpdate(nombre, capa, val.temperatura)
    // }
    if(data.nombre === "CRONO") {
      vMixStore.liveVmixCrono(data.nombre)

    } else {

      vMixStore.liveVmix(data.nombre)
    }
    

  }

  const goPrevio = data => {
    vMixStore.PVWVmix(data)
  }

  const crono = val => {
    if(val === 'start') {
      vMixStore.iniciarCrono()
    } else if (val === 'stop') {
      vMixStore.pararCrono()
    } else if (val === 'pause') {
      vMixStore.pausarCrono()
    }

  }

  watch(() => catClasificacion.value, val => {
    if(val !== null) catClasificacionGeneral.value = null
  })
  watch(() => catClasificacionGeneral.value, val => {
    if(val !== null) catClasificacion.value = null
  })

  // watch(() => textoDSK.value, val => {
  //   if(val !== null) {
  //     const nombre = 'DSK_GENERICO'
  //     const capa = 'GENERICO'
  //     vMixStore.liveUpdate(nombre, capa, val)
  //   }
  // })
  // watch(() => textoPuntoKM.value, val => {
  //   if(val !== null) {
  //     const nombre = 'PUNTO_KILOMETRICO'
  //     const capa = 'GENERICO'
  //     vMixStore.liveUpdate(nombre, capa, val)
  //   }
  // })
  // watch(() => tiempo.value, val => {
  //   if(val !== null) {
  //     const nombre = 'METEO'
  //     let capa
  //     capa = 'CIELO_TXT'
  //     vMixStore.liveUpdate(nombre, capa, val.cielo)
  //     capa = 'VIENTO_TXT'
  //     vMixStore.liveUpdate(nombre, capa, val.viento)
  //     capa = 'TEMP_TXT'
  //     vMixStore.liveUpdate(nombre, capa, val.temperatura)
  //   }
  // },{
  //   deep:true
  // })
  watch(() => corredorBuscado.value, val => {
    // console.log(val)
    if(val) {
      let capa
      let nombre = 'DSK_CORREDOR'
      capa = 'NOMBRE'
      vMixStore.liveUpdate(nombre, capa, val.nombre)
      capa = 'DORSAL'
      vMixStore.liveUpdate(nombre, capa, val.dorsal)
      nombre = 'DSK_CORREDOR_PC'
      capa = 'NOMBRE'
      vMixStore.liveUpdate(nombre, capa, val.nombre)
      capa = 'DORSAL'
      vMixStore.liveUpdate(nombre, capa, val.dorsal)
    }
  },{
    deep:true
  })


  // getData()

</script>

<style scoped>

</style>