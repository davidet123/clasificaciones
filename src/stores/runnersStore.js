// src/stores/runnersStore.js
import { defineStore } from 'pinia';
import Papa from 'papaparse'
import { fetchTextSmart } from '@/utils/csvLoader.js'


export const useRunnersStore = defineStore('runners', {
  state: () => ({
    // list: [
    //   { id: 'A01', dorsal: 101, nombre: 'Ana Pérez', pais: 'ES' },
    //   { id: 'B07', dorsal: 203, nombre: 'Luis Martín', pais: 'ES' },
    //   { id: 'C12', dorsal: 315, nombre: 'Marta López', pais: 'PT' },
    // ],
    selectedId: null,
    fileURL: '/public/LISTADO_ALBACETE.csv',
    urlClasificaciones: 'http://localhost:3500/csv',
    inscritos: [],
    clasificaciones: [],
    categorias: [],
    splits: ['2,2k', '5k', '10k', '15k'],
  }),
  getters: {
    selected(state) {
      return state.list.find(r => r.id === state.selectedId) || null;
    }
  },
  actions: {
    select(id) { this.selectedId = id; },
    async cargarCSV() {
      try {
        // 1) Descargar y decodificar correctamente
        const text = await fetchTextSmart(this.fileURL)

        // 2) Parsear con PapaParse
        const parsed = Papa.parse(text, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
        })

        // console.log(parsed.data)

        // 3) Mapear a tu forma
        this.inscritos = parsed.data.map(el => {
          const corredor = {}
          corredor.nombre = `${el.Nombre ?? ''} ${el.Apellidos ?? ''}`.trim()
          corredor.dorsal = el.Dorsal ?? ''
          // corredor.categoria = el['Cat.'] ?? ''
          // corredor.prueba = el.Prueba ?? ''
          return corredor
        })

      } catch (error) {
        console.error('Error al cargar archivo:', error)
      }
    },
    async cargarClasificacionesCSV() {
      try {
        // 1) Descargar y decodificar correctamente
        const text = await fetchTextSmart(this.urlClasificaciones)

        // 2) Parsear con PapaParse
        const parsed = Papa.parse(text, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
        })

        console.log(parsed.data[0])

        // 3) Mapear a tu forma
        this.clasificaciones = parsed.data.map(el => {
          const corredor = {}
          corredor.nombre = `${el.NOMBRE.split(',')[1] ?? ''} ${el.NOMBRE.split(',')[0] ?? ''}`.trim()
          corredor.dorsal = el.DORSAL ?? ''
          corredor.equipo = el.CLUB ?? ''
          corredor.categoria = el.CATEGORIA ?? ''
          // incluir la categoria si no está ya en el array
          if (corredor.categoria && !this.categorias.includes(corredor.categoria)) {
            this.categorias.push(corredor.categoria)
          }
          corredor.sexo = el.SEX_COR ?? ''

          corredor.tiempos = {}
          this.splits.forEach(split => {
            corredor.tiempos[split] = el[`TIEMPO_CONTROL${this.splits.indexOf(split) + 1}`] ?? ''
          })
          corredor.tiempos['Meta'] = el.TIEMPOOFICIAL ?? ''

          return corredor
        })
        console.log(this.clasificaciones[0] )
        // console.log(this.categorias )

      } catch (error) {
        console.error('Error al cargar archivo:', error)
      }
    },

    enviarClasificacion(categoria, split, listado) {
      // Aquí iría la lógica para enviar las clasificaciones a vMix u otro servicio
      console.log('Enviando clasificaciones...',categoria, split, listado)
    }
    // async cargarCSV() {
    //   try {
    //   const response = await fetch(this.fileURL)
    //   const text = await response.text()

    //   const parsed = Papa.parse(text, {
    //     header: true,
    //     delimiter: ';',
    //     skipEmptyLines: true,
    //   })
    //   // const parsed = Papa.parse(text, {
    //   //   header: true,
    //   //   delimiter: ';',
    //   //   skipEmptyLines: true,
    //   //   complete: (result) => {
    //   //     this.inscritos = result.data
          
    //   //   },
    //   //   error: (err) => {
    //   //     console.error('Error al parsear CSV:', err)
    //   //   }
    //   // })
    //   this.inscritos = parsed.data.map(el => {
    //     const corredor = {}
    //     // console.log(el)

    //     corredor.nombre = `${el.Nombre} ${el.Apellidos}`
    //     corredor.dorsal = el.Dorsal
    //     // corredor.meta = el["TIEMPO OFICIAL"]
    //     corredor.categoria = el["Cat."]
    //     corredor.prueba = el.Prueba
    //     // corredor.sexo = el["SEXO"]
    //     // console.log(el)

    //     return corredor
    //   })
    //   } catch (error) {
    //     console.error('Error al cargar archivo:', error)
    //   }
    // console.log(this.inscritos)
    // },
  }
});
