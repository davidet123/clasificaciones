import { defineStore } from 'pinia'
import axios from 'axios'
import { XMLParser } from "fast-xml-parser"
import { useNombreUtils } from '@/composables/useNombreUtils'

const { quitarUltimoApellido } = useNombreUtils()

export const usevMixStore = defineStore('vMixStore', {
  state: () => ({
    // url: "http://192.168.1.153:8088/", 
    url: "http://192.168.50.200:8088/", 
    inicioPartida: null,
    crono: null,
    tiempoPartida: "00:00:00",
    tiempoActual: null,
    tiempoPausa: null,
    status: 500,
    errorTxt: null,
    cargando: false,
    listadoDSK: [
      "Ibi (Alicante)",
      "Cabeza carrera masculina",
      "Cabeza carrera femenina",
      "SALIDA",
      "META",
      "MOTO 1",
      "MOTO 2"
    ],
    puntosKM: [
      "Km 1",
      "Km 2",
      "Km 3",
      "Km 4",
      "Km 5",
      "Km 6",
      "Km 7",
      "Km 8",
      "Km 9",
      "Km 10",
      "META",
    ],
    tiempo: {
      cielo: null,
      viento: null,
      temperatura: null,

    }
  }),
  actions: { 

    async getStatusVmix () {
      const res = await axios.post(`${this.url}API/`)
      // console.log(res.data)

      const parser = new XMLParser();
      const jsonData = parser.parse(res.data)
      console.log(jsonData)

    },
    async pingVmix () {
      this.errorTxt = null
      this.status = 500
      this.cargando = true
      const nombre = "Colour"
      let dir = this.url +"API/?Function=ActiveInput&Input=" + nombre
        const send = await axios.post(dir)
          .catch(err => {
            console.log("Error de conexión " + err)
            this.errorTxt = err
          })
        if(send) this.status = send.status
        this.cargando = false

    },
    async liveUpdate (nombre, capa, val) {
        let dir = this.url +"API/?Function=SetText&Input=" + nombre + "&SelectedName=" + capa + ".Text&Value=" + val
        const send = await axios.post(dir)
          .catch(err => {
            console.log("Error de conexión " + err)
          })
      },
    
    async iniciarCrono() {
      const nombre = "CRONO"
      const capa = "TIEMPO_TXT"
      const dir = this.url +"API/?Function=StartCountdown&Input=" + nombre + "&SelectedName=" + capa + ".Text"
      const send = await axios.post(dir)
        .catch(err => {
          console.log("Error de conexión " + err)
        })

    },
    async pararCrono() {
      const nombre = "CRONO"
      const capa = "TIEMPO_TXT"
      const dir = this.url +"API/?Function=StopCountdown&Input=" + nombre + "&SelectedName=" + capa + ".Text"
      const send = await axios.post(dir)
        .catch(err => {
          console.log("Error de conexión " + err)
        })
        
    },
    async pausarCrono() {
      const nombre = "CRONO"
      const capa = "TIEMPO_TXT"
      const dir = this.url +"API/?Function=PauseCountdown&Input=" + nombre + "&SelectedName=" + capa + ".Text"
      const send = await axios.post(dir)
        .catch(err => {
          console.log("Error de conexión " + err)
        })
    },
    convertirMilisegundosAHHMMSS(valor) {
      if (valor > 1000000000000) { // Si es timestamp
        console.log('timestamp')
        return new Date(valor).toTimeString().split(' ')[0];
      } else { // Si es duración
          const horas = Math.floor(valor / 3600000);
          const minutos = Math.floor((valor % 3600000) / 60000);
          const segundos = Math.floor((valor % 60000) / 1000);
          return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
      }
    },
    // convertirMilisegundosAHHMMSS(ms) {
    //   const totalSegundos = Math.floor(ms / 1000);
    //   const horas = Math.floor(totalSegundos / 3600);
    //   const minutos = Math.floor((totalSegundos % 3600) / 60);
    //   const segundos = totalSegundos % 60;

    //   const formatoDosDigitos = (num) => String(num).padStart(2, '0');

    //   return `${formatoDosDigitos(horas)}:${formatoDosDigitos(minutos)}:${formatoDosDigitos(segundos)}`;
    // },
    async liveVmix (payload) {
      let dir = this.url +"API/?Function=OverlayInput2&Input=" + payload
      const send = await axios.post(dir)
      .catch(err => {
        console.log("Error de conexión " + err)
      })
    },
    async liveVmixCrono (payload) {
      let dir = this.url +"API/?Function=OverlayInput4&Input=" + payload
      const send = await axios.post(dir)
      .catch(err => {
        console.log("Error de conexión " + err)
      })
    },

    async PVWVmix(payload) {
      let dir = this.url +"API/?Function=PreviewInput&Input=" + payload
      const send = await axios.post(dir)
        .catch(err => {
          console.log("Error de conexión " + err)
        })
    },
    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    async envioClasificacionesvMix (listado, nombreClasificacion, input, split,  filas)  {
      if(listado.length <= filas) filas = listado.length

      this.liveUpdate(input, "CLAS_CATEGORIA", "CLASIFICACION " + nombreClasificacion)

      for(let i = 1; i <= 11 ; i++) {      
        // LIMPIAR CLASIFICACIONES
        this.liveUpdate(input, `NUM_CLAS${i}`, "")
        this.liveUpdate(input, `NOMBRE_CLAS${i}`, "")
        this.liveUpdate(input, `TIEMPO_CLAS${i}`, "")
      }
      let orden = 1
      for(let i = 0; i < filas; i++) {      
        // LIMPIAR CLASIFICACIONES
        let nombre = `${listado[i].nombre}`
        // if(filas == 5) nombre = quitarUltimoApellido(listado[i].nombre)

        // console.log(orden)
        this.liveUpdate(input, `NUM_CLAS${orden}`, orden)
        await this.wait(50)
        this.liveUpdate(input, `NOMBRE_CLAS${orden}`, nombre)
        await this.wait(50)
        const tiempo = this.convertirMilisegundosAHHMMSS(listado[i].tiempos[split])
        this.liveUpdate(input, `TIEMPO_CLAS${orden}`, tiempo)
        await this.wait(50)
        orden ++
      }

    }
      

  },
})