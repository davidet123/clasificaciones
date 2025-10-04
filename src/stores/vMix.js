import { defineStore } from 'pinia'
import axios from 'axios'
import { XMLParser } from "fast-xml-parser"
import { useNombreUtils } from '@/composables/useNombreUtils'

const { quitarUltimoApellido } = useNombreUtils()

export const usevMixStore = defineStore('vMixStore', {
  state: () => ({
    // url: "http://192.168.1.153:8088/", 
    // url: "http://192.168.50.200:8088/", 
    url: "http://localhost:8088/", 
    inicioPartida: null,
    cronoEnPrograma: false,
    crono: null,
    tiempoPartida: "00:00:00",
    tiempoActual: null,
    tiempoPausa: null,
    status: 500,
    errorTxt: null,
    cargando: false,
    listadoDSK: [
      "Alabacete",
      "Cabeza carrera masculina",
      "Cabeza carrera femenina",
      "SALIDA",
      "META",
      "MOTO 1",
      "MOTO 2"
    ],
    puntosKM: [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "META",
    ],
    // puntosKM: [
    //   "Km 1",
    //   "Km 2",
    //   "Km 3",
    //   "Km 4",
    //   "Km 5",
    //   "Km 6",
    //   "Km 7",
    //   "Km 8",
    //   "Km 9",
    //   "Km 10",
    //   "Km 11",
    //   "Km 12",
    //   "Km 13",
    //   "Km 14",
    //   "Km 15",
    //   "Km 16",
    //   "Km 17",
    //   "Km 18",
    //   "Km 19",
    //   "Km 20",
    //   "Km 21",
    //   "META",
    // ],
    tiempo: {
      cielo: null,
      viento: null,
      temperatura: null,
    },
    cronos: ['CRONO', 'DSK_CORREDOR'],
    // cache anti-spam para SetText (input|capa -> value)
    _lastTextCache: Object.create(null),
  }),
  actions: { 

    async getStatusVmix () {
      const res = await axios.post(`${this.url}API/`)
      const parser = new XMLParser();
      const jsonData = parser.parse(res.data)
      console.log(jsonData)
    },

    async pingVmix () {
      this.errorTxt = null
      this.status = 500
      this.cargando = true
      const nombre = "Colour"
      const dir = this.url +"API/?Function=ActiveInput&Input=" + nombre
      const send = await axios.post(dir)
        .catch(err => {
          console.log("Error de conexión " + err)
          this.errorTxt = err
        })
      if (send) this.status = send.status
      this.cargando = false
    },

    // Envía SetText siempre
    async liveUpdate (nombre, capa, val) {
      const dir = this.url +"API/?Function=SetText&Input=" + nombre + "&SelectedName=" + capa + ".Text&Value=" + encodeURIComponent(val ?? '')
      await axios.post(dir).catch(err => {
        console.log("Error de conexión " + err)
      })
    },

    // Envía SetText solo si el valor cambia (reduce tráfico)
    async setTextCached (nombre, capa, val) {
      // console.log(nombre, capa, val)
      const key = `${nombre}|${capa}`
      const str = String(val ?? '')
      if (this._lastTextCache[key] === str) return
      this._lastTextCache[key] = str
      await this.liveUpdate(nombre, capa, str)
    },
    
    async iniciarCrono() {
      this.cronos.forEach(async crono => {
        const nombre = crono
        const capa = "TIEMPO_TXT"
        const dir = this.url +"API/?Function=StartCountdown&Input=" + nombre + "&SelectedName=" + capa + ".Text"
        await axios.post(dir).catch(err => {
          console.log("Error de conexión " + err)
        })
      })
    },

    async pararCrono() {
      this.cronos.forEach(async crono => {
        const nombre = crono
        const capa = "TIEMPO_TXT"
        const dir = this.url +"API/?Function=StopCountdown&Input=" + nombre + "&SelectedName=" + capa + ".Text"
        await axios.post(dir).catch(err => {
          console.log("Error de conexión " + err)
        })
      })
    },

    async pausarCrono() {
      this.cronos.forEach(async crono => {
        const nombre = crono
        const capa = "TIEMPO_TXT"
        const dir = this.url +"API/?Function=PauseCountdown&Input=" + nombre + "&SelectedName=" + capa + ".Text"
        await axios.post(dir).catch(err => {
          console.log("Error de conexión " + err)
        })
      })
    },

    convertirMilisegundosAHHMMSS(valor) {
      if (valor > 1000000000000) { // Si es timestamp
        return new Date(valor).toTimeString().split(' ')[0];
      } else { // Si es duración
        const horas = Math.floor(valor / 3600000);
        const minutos = Math.floor((valor % 3600000) / 60000);
        const segundos = Math.floor((valor % 60000) / 1000);
        return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
      }
    },

    async liveVmix (payload) {
      const dir = this.url +"API/?Function=OverlayInput2&Input=" + payload
      await axios.post(dir).catch(err => {
        console.log("Error de conexión " + err)
      })
    },

    async liveVmixCrono (payload) {
      const dir = this.url +"API/?Function=OverlayInput4&Input=" + payload
      await axios.post(dir).catch(err => {
        console.log("Error de conexión " + err)
      })
    },

    async PVWVmix(payload) {
      const dir = this.url +"API/?Function=PreviewInput&Input=" + payload
      await axios.post(dir).catch(err => {
        console.log("Error de conexión " + err)
      })
    },

    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },

    async envioClasificacionesvMix (listado, nombreClasificacion, input, split,  filas)  {
      if(listado.length <= filas) filas = listado.length

      this.liveUpdate(input, "CATEGORIA", "CLASIFICACION " + nombreClasificacion)

      for(let i = 1; i <= 11 ; i++) {      
        // LIMPIAR CLASIFICACIONES
        // this.liveUpdate(input, `NUM_CLAS${i}`, "")
        this.liveUpdate(input, `NOMBRE_CLAS${i}`, "")
        this.liveUpdate(input, `TIEMPO_CLAS${i}`, "")
        this.liveUpdate(input, `EQUIPO_CLAS${i}`, "")
      }
      let orden = 1
      for(let i = 0; i < filas; i++) {      
        // this.liveUpdate(input, `NUM_CLAS${orden}`, orden)
        // await this.wait(50)
        let nombre = quitarUltimoApellido(listado[i].nombre)
        // console.log(nombre)
        if(filas <= 5) nombre = `${listado[i].dorsal} - ${nombre}`
        this.liveUpdate(input, `NOMBRE_CLAS${orden}`, nombre)
        await this.wait(50)
        const equipo = `${listado[i].equipo || ""}  `
        this.liveUpdate(input, `EQUIPO_CLAS${orden}`, equipo)
        await this.wait(50)
        // const tiempo = this.convertirMilisegundosAHHMMSS(listado[i].tiempos[split])
        const tiempo = listado[i].tiempos[split]
        this.liveUpdate(input, `TIEMPO_CLAS${orden}`, tiempo)
        await this.wait(50)
        orden ++
      }
    }
  },
})
