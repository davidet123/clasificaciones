import { defineStore } from 'pinia'
import axios from 'axios'

export const usevMixStore = defineStore('vMixStore', {
  state: () => ({
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
      "IBI",
      "SALIDA",
      "META",
      "MOTO 1",
      "MOTO 2"
    ],
    puntosKM: [
      "5km",
      "10km",
      "15km",
      "20km",
      "META",
    ],
    tiempo: {
      cielo: null,
      viento: null,
      temperatura: null,

    }
  }),
  actions: { 
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
    convertirMilisegundosAHHMMSS(ms) {
      const totalSegundos = Math.floor(ms / 1000);
      const horas = Math.floor(totalSegundos / 3600);
      const minutos = Math.floor((totalSegundos % 3600) / 60);
      const segundos = totalSegundos % 60;

      const formatoDosDigitos = (num) => String(num).padStart(2, '0');

      return `${formatoDosDigitos(horas)}:${formatoDosDigitos(minutos)}:${formatoDosDigitos(segundos)}`;
    },
    async liveVmix (payload) {
      let dir = this.url +"API/?Function=OverlayInput2&Input=" + payload
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
    }
      

  },
})