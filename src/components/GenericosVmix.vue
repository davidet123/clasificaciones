<template>
  <v-row class="my-2">
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
    
  </v-row>
  <v-row class="ma-0 pa-0">
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
  </v-row>
</template>

<script setup>

  import { storeToRefs } from 'pinia'

  import { usevMixStore } from '@/stores/vMix'

  import BotonLive from '@/components/BotonLive.vue'
  import BotonPrevio from '@/components/BotonPrevio.vue'
  import { ref, watch } from 'vue'

  const vMixStore = usevMixStore()

  const { listadoDSK, puntosKM, tiempo } = storeToRefs(vMixStore)

  const textoDSK = ref(null)
  const textoPuntoKM = ref(null)

   const crono = val => {
    if(val === 'start') {
      vMixStore.iniciarCrono()
    } else if (val === 'stop') {
      vMixStore.pararCrono()
    } else if (val === 'pause') {
      vMixStore.pausarCrono()
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




  watch(() => textoDSK.value, val => {
    if(val !== null) {
      const nombre = 'DSK_GENERICO'
      const capa = 'GENERICO'
      vMixStore.liveUpdate(nombre, capa, val)
    }
  })
  watch(() => textoPuntoKM.value, val => {
    if(val !== null) {
      const nombre = 'PUNTO_KILOMETRICO'
      const capa = 'GENERICO'
      vMixStore.liveUpdate(nombre, capa, val)
    }
  })
  watch(() => tiempo.value, val => {
    if(val !== null) {
      const nombre = 'METEO'
      let capa
      capa = 'CIELO_TXT'
      vMixStore.liveUpdate(nombre, capa, val.cielo)
      capa = 'VIENTO_TXT'
      vMixStore.liveUpdate(nombre, capa, val.viento)
      capa = 'TEMP_TXT'
      vMixStore.liveUpdate(nombre, capa, val.temperatura)
    }
  },{
    deep:true
  })

</script>

<style lang="scss" scoped>

</style>